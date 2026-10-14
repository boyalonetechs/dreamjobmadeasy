use actix_cors::Cors;
use actix_web::{get, post, put, delete, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use aws_config::BehaviorVersion;
use aws_sdk_s3::{config::Region, config::Builder as S3ConfigBuilder, presigning::PresigningConfig, Client as S3Client};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{DateTime, Duration, Utc};
use futures_util::TryStreamExt;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{FromRow, PgPool};
use std::time::Duration as StdDuration;
use uuid::Uuid;

// ---------------------------------------------------------------- state

pub struct AppState {
    pool: PgPool,
    jwt_secret: String,
    frontend_url: String,
    paystack_secret: Option<String>,
    paypal_client_id: Option<String>,
    paypal_secret: Option<String>,
    paypal_base: String,
    price_ngn_kobo: u64,
    price_usd: String,
    payments_demo_mode: bool,
    s3: S3Client,
    wasabi_bucket: String,
    admin_emails: Vec<String>,
}

#[derive(Clone, Serialize, FromRow)]
struct User {
    id: Uuid,
    name: String,
    email: String,
    #[serde(skip_serializing)]
    password_hash: String,
    has_access: bool,
    plan: Option<String>,
    is_admin: bool,
    created_at: DateTime<Utc>,
}

const USER_COLUMNS: &str = "id, name, email, password_hash, has_access, plan, is_admin, created_at";

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
}

// ---------------------------------------------------------------- catalogue
// Chapter metadata lives in `chapters`; the URLs live in `audio_files`.
// Every tape is gated: nothing plays until the user has paid.

#[derive(FromRow, Serialize)]
struct ChapterRow {
    id: String,
    no: i16,
    title: String,
    blurb: String,
    minutes: i32,
    duration_label: String,
    cover_image_url: Option<String>,
    sample_url: Option<String>,
    full_url: Option<String>,
    sample_key: Option<String>,
    full_key: Option<String>,
}

const CHAPTERS_QUERY: &str = r#"
    SELECT c.id, c.no, c.title, c.blurb, c.minutes,
           c.duration_label, c.cover_image_url,
           s.audio_url AS sample_url, s.storage_key AS sample_key,
           f.audio_url AS full_url, f.storage_key AS full_key
    FROM chapters c
    LEFT JOIN audio_files s ON s.chapter_id = c.id AND s.kind = 'sample'
    LEFT JOIN audio_files f ON f.chapter_id = c.id AND f.kind = 'full'
    ORDER BY c.sort_order
"#;

async fn load_chapters(pool: &PgPool) -> Result<Vec<ChapterRow>, sqlx::Error> {
    sqlx::query_as::<_, ChapterRow>(CHAPTERS_QUERY).fetch_all(pool).await
}

// ---------------------------------------------------------------- helpers

fn sign_token(user_id: &Uuid, secret: &str) -> String {
    let exp = (Utc::now() + Duration::days(7)).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("jwt sign")
}

fn db_error(e: sqlx::Error) -> HttpResponse {
    log::error!("database error: {e}");
    HttpResponse::InternalServerError()
        .json(serde_json::json!({ "error": "Something went wrong on our side. Try again." }))
}

/// Turn a title into a URL/id-safe slug: lowercase, alphanumerics, single dashes.
fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    let trimmed = out.trim_matches('-');
    if trimmed.is_empty() {
        "chapter".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Build a unique chapter id from a title, appending `-2`, `-3`, … on collision.
async fn unique_chapter_id(pool: &PgPool, title: &str) -> Result<String, sqlx::Error> {
    let base = slugify(title);
    let mut candidate = base.clone();
    let mut n = 2;
    loop {
        let exists: bool =
            sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM chapters WHERE id = $1)")
                .bind(&candidate)
                .fetch_one(pool)
                .await?;
        if !exists {
            return Ok(candidate);
        }
        candidate = format!("{base}-{n}");
        n += 1;
    }
}

async fn auth_user(
    req: &HttpRequest,
    data: &web::Data<AppState>,
) -> Result<Option<User>, sqlx::Error> {
    let Some(token) = token_from_request(req) else {
        return Ok(None);
    };
    auth_token(&token, data).await
}

/// Pull a JWT from the Authorization header or a `?token=` query param
/// (the two ways browsers can send a token — e.g. <audio>/<img> tags can't
/// set headers, so they use the query param).
fn token_from_request(req: &HttpRequest) -> Option<String> {
    if let Some(header) = req.headers().get("Authorization") {
        if let Ok(header) = header.to_str() {
            if let Some(token) = header.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }
    let query = req.query_string();
    if let Some(pair) = query.split('&').find(|p| p.starts_with("token=")) {
        let token = pair.trim_start_matches("token=");
        if !token.is_empty() {
            return Some(token.to_string());
        }
    }
    None
}

async fn auth_token(token: &str, data: &web::Data<AppState>) -> Result<Option<User>, sqlx::Error> {
    let Ok(decoded) = decode::<Claims>(
        token,
        &DecodingKey::from_secret(data.jwt_secret.as_bytes()),
        &Validation::default(),
    ) else {
        return Ok(None);
    };
    let Ok(id) = Uuid::parse_str(&decoded.claims.sub) else {
        return Ok(None);
    };
    let sql = format!("SELECT {USER_COLUMNS} FROM users WHERE id = $1");
    Ok(
        sqlx::query_as::<_, User>(&sql)
            .bind(id)
            .fetch_optional(&data.pool)
            .await?,
    )
}

/// Grant access and stamp the plan on the user row.
async fn unlock(
    pool: &PgPool,
    user_id: Uuid,
    plan: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE users SET has_access = TRUE, plan = $2, updated_at = now() WHERE id = $1")
        .bind(user_id)
        .bind(plan)
        .execute(pool)
        .await?;
    Ok(())
}

/// Upsert a payment row. Re-verifying the same reference updates the existing
/// row rather than double-crediting access.
#[allow(clippy::too_many_arguments)]
async fn record_payment(
    pool: &PgPool,
    user_id: Uuid,
    provider: &str,
    reference: &str,
    amount_minor: i64,
    currency: &str,
    status: &str,
    raw: Option<serde_json::Value>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO payments
            (user_id, provider, provider_reference, amount_minor, currency, status, raw)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (provider, provider_reference) DO UPDATE
            SET status = EXCLUDED.status,
                raw = EXCLUDED.raw,
                amount_minor = EXCLUDED.amount_minor,
                updated_at = now()
        "#,
    )
    .bind(user_id)
    .bind(provider)
    .bind(reference)
    .bind(amount_minor)
    .bind(currency)
    .bind(status)
    .bind(raw)
    .execute(pool)
    .await?;
    Ok(())
}

// Demo payments are opt-in only. They must never be inferred from a missing
// key, otherwise a misconfigured deploy lets every account unlock for free.
fn demo_mode(data: &AppState) -> bool {
    data.payments_demo_mode
}

fn paystack_ready(data: &AppState) -> bool {
    data.paystack_secret.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
}

fn paypal_ready(data: &AppState) -> bool {
    data.paypal_client_id.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
}

fn payments_not_configured(provider: &str) -> HttpResponse {
    HttpResponse::ServiceUnavailable().json(serde_json::json!({
        "error": format!("{provider} is not configured. Set the provider keys or enable PAYMENTS_DEMO_MODE for local testing."),
        "code": "payments_not_configured"
    }))
}

#[derive(Serialize)]
struct AuthPayload {
    token: String,
    user: PublicUser,
}

#[derive(Serialize, Clone)]
struct PublicUser {
    id: Uuid,
    name: String,
    email: String,
    has_access: bool,
    plan: Option<String>,
    is_admin: bool,
}

impl From<&User> for PublicUser {
    fn from(u: &User) -> Self {
        Self {
            id: u.id,
            name: u.name.clone(),
            email: u.email.clone(),
            has_access: u.has_access,
            plan: u.plan.clone(),
            is_admin: u.is_admin,
        }
    }
}

fn is_admin(user: &User, admin_emails: &[String]) -> bool {
    user.is_admin || admin_emails.iter().any(|e| e.eq_ignore_ascii_case(&user.email))
}

// ---------------------------------------------------------------- routes

#[get("/api/health")]
async fn health(data: web::Data<AppState>) -> impl Responder {
    match sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&data.pool).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "service": "dreamjobmadeeasy-api",
            "database": "up"
        })),
        Err(e) => {
            log::error!("health check db failure: {e}");
            HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "ok": false,
                "service": "dreamjobmadeeasy-api",
                "database": "down"
            }))
        }
    }
}

#[derive(Deserialize)]
struct SignupBody {
    name: String,
    email: String,
    password: String,
}

#[post("/api/auth/signup")]
async fn signup(data: web::Data<AppState>, body: web::Json<SignupBody>) -> impl Responder {
    let email = body.email.trim().to_lowercase();
    let name = body.name.trim().to_string();
    if name.is_empty() || email.is_empty() || body.password.len() < 6 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Give your name, a valid email and a password of 6+ characters."
        }));
    }
    if !email.contains('@') {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({ "error": "That email does not look right. Check it and try again." }));
    }

    let password = body.password.clone();
    let hash_out = web::block(move || hash(&password, DEFAULT_COST)).await;
    let password_hash = match hash_out {
        Ok(Ok(h)) => h,
        Ok(Err(e)) => {
            log::error!("bcrypt hash failed: {e}");
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "Could not create account." }));
        }
        Err(_) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "Could not create account." }));
        }
    };

    let sql = format!(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING {USER_COLUMNS}"
    );
    let inserted = sqlx::query_as::<_, User>(&sql)
        .bind(&name)
        .bind(&email)
        .bind(&password_hash)
        .fetch_one(&data.pool)
        .await;

    let user = match inserted {
        Ok(u) => u,
        Err(sqlx::Error::Database(ref e)) if e.is_unique_violation() => {
            return HttpResponse::Conflict().json(serde_json::json!({
                "error": "An account with this email already exists. Log in instead."
            }));
        }
        Err(e) => return db_error(e),
    };

    let token = sign_token(&user.id, &data.jwt_secret);
    HttpResponse::Created().json(AuthPayload {
        token,
        user: PublicUser::from(&user),
    })
}

#[derive(Deserialize)]
struct LoginBody {
    email: String,
    password: String,
}

#[post("/api/auth/login")]
async fn login(data: web::Data<AppState>, body: web::Json<LoginBody>) -> impl Responder {
    let email = body.email.trim().to_lowercase();
    let sql = format!("SELECT {USER_COLUMNS} FROM users WHERE lower(email) = $1");
    let user = match sqlx::query_as::<_, User>(&sql)
        .bind(&email)
        .fetch_optional(&data.pool)
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "No account with this email. Create one to start listening."
            }))
        }
        Err(e) => return db_error(e),
    };

    let password = body.password.clone();
    let hash_to_check = user.password_hash.clone();
    let verified = web::block(move || verify(&password, &hash_to_check)).await;

    match verified {
        Ok(Ok(true)) => {
            let token = sign_token(&user.id, &data.jwt_secret);
            HttpResponse::Ok().json(AuthPayload {
                token,
                user: PublicUser::from(&user),
            })
        }
        _ => HttpResponse::Unauthorized()
            .json(serde_json::json!({ "error": "Wrong password for this email." })),
    }
}

#[get("/api/auth/me")]
async fn me(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    match auth_user(&req, &data).await {
        Ok(Some(u)) => HttpResponse::Ok().json(PublicUser::from(&u)),
        Ok(None) => HttpResponse::Unauthorized()
            .json(serde_json::json!({ "error": "Log in again to continue." })),
        Err(e) => db_error(e),
    }
}

fn format_naira(kobo: u64) -> String {
    let digits = (kobo / 100).to_string();
    let mut grouped = String::new();
    let len = digits.len();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(ch);
    }
    format!("₦{}", grouped)
}

#[get("/api/book")]
async fn book(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    let unlocked = match auth_user(&req, &data).await {
        Ok(u) => u.map(|u| u.has_access).unwrap_or(false),
        Err(e) => return db_error(e),
    };
    let rows = match load_chapters(&data.pool).await {
        Ok(r) => r,
        Err(e) => return db_error(e),
    };
    let chapters: Vec<serde_json::Value> = rows
        .iter()
        .map(|c| {
            serde_json::json!({
                "id": c.id,
                "no": c.no,
                "title": c.title,
                "duration_label": c.duration_label,
                "minutes": c.minutes,
                "blurb": c.blurb,
                "cover_image_url": c.cover_image_url,
                "free": false,
                "locked": !unlocked,
                // no url of any kind escapes until the account is paid for
                "sample_url": if unlocked { c.sample_url.clone() } else { None },
                "audio_url": if unlocked { c.full_url.clone() } else { None },
            })
        })
        .collect();
    HttpResponse::Ok().json(serde_json::json!({
        "title": "Dream Job Made Easy",
        "subtitle": "The 8-part audiobook for getting shortlisted, interviewed and hired.",
        "total": "3 hrs 26 min",
        "price_ngn": format_naira(data.price_ngn_kobo),
        "price_ngn_kobo": data.price_ngn_kobo,
        "price_usd": format!("${}", data.price_usd),
        "unlocked": unlocked,
        "chapters": chapters,
    }))
}

// Gate the real file. The <audio> element never gets a URL unless paid.

// ---------------- Paystack (naira)

#[derive(Deserialize)]
struct PaystackInitBody {
    email: String,
}

#[post("/api/payments/paystack/initialize")]
async fn paystack_init(
    req: HttpRequest,
    data: web::Data<AppState>,
    body: web::Json<PaystackInitBody>,
) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    let reference = format!("DJME-{}", &Uuid::new_v4().to_string()[..8].to_uppercase());
    let callback = format!("{}/success?provider=paystack&reference={}", data.frontend_url, reference);

    // Demo mode is opt-in only (PAYMENTS_DEMO_MODE); never inferred from keys.
    if demo_mode(&data) {
        return HttpResponse::Ok().json(serde_json::json!({
            "mock": true,
            "reference": reference,
            "authorization_url": format!("{}/success?provider=paystack&reference={}&mock=1", data.frontend_url, reference),
            "message": "PAYMENTS_DEMO_MODE enabled, running in demo mode."
        }));
    }
    if !paystack_ready(&data) {
        return payments_not_configured("Paystack");
    }

    let client = reqwest::Client::new();
    let secret = data.paystack_secret.clone().unwrap_or_default();
    let res = client
        .post("https://api.paystack.co/transaction/initialize")
        .bearer_auth(secret)
        .json(&serde_json::json!({
            "email": body.email,
            "amount": data.price_ngn_kobo.to_string(),
            "reference": reference,
            "callback_url": callback,
            "metadata": { "product": "dreamjobmadeeasy-audiobook" }
        }))
        .send()
        .await;
    match res {
        Ok(r) => {
            let http_ok = r.status().is_success();
            let v: serde_json::Value = r.json().await.unwrap_or(serde_json::json!({}));
            let provider_ok =
                http_ok && v.get("status").and_then(|s| s.as_bool()).unwrap_or(false);
            if !provider_ok {
                let msg = v
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("Paystack rejected the request.");
                return HttpResponse::BadGateway().json(serde_json::json!({
                    "error": format!("Paystack: {msg}"),
                    "code": "paystack_error",
                }));
            }
            let ref_out = v
                .pointer("/data/reference")
                .and_then(|r| r.as_str())
                .unwrap_or("");
            if ref_out.is_empty() {
                return HttpResponse::BadGateway()
                    .json(serde_json::json!({ "error": "Paystack did not return a reference." }));
            }
            if let Err(e) = record_payment(
                &data.pool,
                user.id,
                "paystack",
                ref_out,
                data.price_ngn_kobo as i64,
                "NGN",
                "pending",
                Some(v.clone()),
            )
            .await
            {
                return db_error(e);
            }
            HttpResponse::Ok().json(v)
        }
        Err(e) => HttpResponse::BadGateway().json(serde_json::json!({ "error": format!("Paystack error: {e}") })),
    }
}

#[get("/api/payments/paystack/verify/{reference}")]
async fn paystack_verify(
    req: HttpRequest,
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let reference = path.into_inner();
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };

    // Demo references only unlock when demo mode is explicitly enabled.
    if reference.starts_with("DJME-") {
        if !demo_mode(&data) {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "error": "Unknown payment reference." }));
        }
        if let Err(e) = record_payment(
            &data.pool,
            user.id,
            "paystack",
            &reference,
            data.price_ngn_kobo as i64,
            "NGN",
            "success",
            Some(serde_json::json!({ "mock": true })),
        )
        .await
        {
            return db_error(e);
        }
        if let Err(e) = unlock(&data.pool, user.id, "paystack").await {
            return db_error(e);
        }
        return HttpResponse::Ok().json(serde_json::json!({
            "ok": true, "mock": true, "has_access": true, "message": "Demo payment accepted."
        }));
    }

    if !paystack_ready(&data) {
        return payments_not_configured("Paystack");
    }
    let secret = data.paystack_secret.clone().unwrap_or_default();
    let client = reqwest::Client::new();
    let res = client
        .get(format!("https://api.paystack.co/transaction/verify/{reference}"))
        .bearer_auth(secret)
        .send()
        .await;
    match res {
        Ok(r) => {
            let v: serde_json::Value = r.json().await.unwrap_or(serde_json::json!({}));
            let paid = v.pointer("/data/status").and_then(|s| s.as_str()) == Some("success");
            if paid {
                if let Err(e) = record_payment(
                    &data.pool,
                    user.id,
                    "paystack",
                    &reference,
                    data.price_ngn_kobo as i64,
                    "NGN",
                    "success",
                    Some(v.clone()),
                )
                .await
                {
                    return db_error(e);
                }
                if let Err(e) = unlock(&data.pool, user.id, "paystack").await {
                    return db_error(e);
                }
                HttpResponse::Ok().json(serde_json::json!({ "ok": true, "has_access": true, "data": v }))
            } else {
                let _ = record_payment(
                    &data.pool,
                    user.id,
                    "paystack",
                    &reference,
                    data.price_ngn_kobo as i64,
                    "NGN",
                    "failed",
                    Some(v.clone()),
                )
                .await;
                HttpResponse::PaymentRequired()
                    .json(serde_json::json!({ "ok": false, "error": "Payment not confirmed yet.", "data": v }))
            }
        }
        Err(e) => HttpResponse::BadGateway().json(serde_json::json!({ "error": format!("Paystack error: {e}") })),
    }
}

// ---------------- PayPal (dollar)

#[post("/api/payments/paypal/create-order")]
async fn paypal_create(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    if let Err(e) = auth_user(&req, &data).await {
        return db_error(e);
    }
    let mock_id = format!("MOCK-{}", &Uuid::new_v4().to_string()[..8].to_uppercase());
    if demo_mode(&data) {
        return HttpResponse::Ok().json(serde_json::json!({
            "mock": true,
            "order_id": mock_id,
            "approval_url": format!("{}/success?provider=paypal&order_id={}&mock=1", data.frontend_url, mock_id),
        }));
    }
    if !paypal_ready(&data) {
        return payments_not_configured("PayPal");
    }
    let client = reqwest::Client::new();
    let cid = data.paypal_client_id.clone().unwrap_or_default();
    let csec = data.paypal_secret.clone().unwrap_or_default();
    let token_res = client
        .post(format!("{}/v1/oauth2/token", data.paypal_base))
        .basic_auth(cid, Some(csec))
        .form(&[("grant_type", "client_credentials")])
        .send()
        .await;
    let token_res = match token_res {
        Ok(r) => r.json::<serde_json::Value>().await.unwrap_or_default(),
        Err(e) => return HttpResponse::BadGateway().json(serde_json::json!({ "error": format!("PayPal auth error: {e}") })),
    };
    let access = token_res.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if access.is_empty() {
        return HttpResponse::BadGateway().json(serde_json::json!({ "error": "Could not reach PayPal." }));
    }
    let order = client
        .post(format!("{}/v2/checkout/orders", data.paypal_base))
        .bearer_auth(access)
        .json(&serde_json::json!({
            "intent": "CAPTURE",
            "purchase_units": [{
                "description": "Dream Job Made Easy — full audiobook",
                "amount": { "currency_code": "USD", "value": data.price_usd }
            }],
            "application_context": {
                "return_url": format!("{}/success?provider=paypal", data.frontend_url),
                "cancel_url": format!("{}/pricing", data.frontend_url),
            }
        }))
        .send()
        .await;
    match order {
        Ok(r) => {
            let http_ok = r.status().is_success();
            let v: serde_json::Value = r.json().await.unwrap_or_default();
            let order_id = v.get("id").and_then(|i| i.as_str());
            if !http_ok || order_id.is_none() {
                let msg = v
                    .pointer("/message")
                    .or_else(|| v.pointer("/error_description"))
                    .and_then(|m| m.as_str())
                    .unwrap_or("PayPal could not create the order.");
                return HttpResponse::BadGateway().json(serde_json::json!({
                    "error": format!("PayPal: {msg}"),
                    "code": "paypal_error",
                }));
            }
            let approval = v.get("links").and_then(|l| l.as_array()).and_then(|links| {
                links.iter().find(|l| l.get("rel").and_then(|r| r.as_str()) == Some("approve")).cloned()
            });
            HttpResponse::Ok().json(serde_json::json!({
                "order_id": order_id,
                "approval_url": approval.and_then(|a| a.get("href").cloned()),
                "raw": v,
            }))
        }
        Err(e) => HttpResponse::BadGateway().json(serde_json::json!({ "error": format!("PayPal error: {e}") })),
    }
}

#[derive(Deserialize)]
struct CaptureBody {
    order_id: String,
}

#[post("/api/payments/paypal/capture")]
async fn paypal_capture(
    req: HttpRequest,
    data: web::Data<AppState>,
    body: web::Json<CaptureBody>,
) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    let usd_minor: i64 = data
        .price_usd
        .split('.')
        .next()
        .and_then(|v| v.parse::<i64>().ok())
        .map(|v| v * 100)
        .unwrap_or(1900);

    if body.order_id.starts_with("MOCK-") {
        if !demo_mode(&data) {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "error": "Unknown PayPal order." }));
        }
        if let Err(e) = record_payment(
            &data.pool,
            user.id,
            "paypal",
            &body.order_id,
            usd_minor,
            "USD",
            "success",
            Some(serde_json::json!({ "mock": true })),
        )
        .await
        {
            return db_error(e);
        }
        if let Err(e) = unlock(&data.pool, user.id, "paypal").await {
            return db_error(e);
        }
        return HttpResponse::Ok().json(serde_json::json!({ "ok": true, "mock": true, "has_access": true }));
    }
    if !paypal_ready(&data) {
        return payments_not_configured("PayPal");
    }
    let client = reqwest::Client::new();
    let cid = data.paypal_client_id.clone().unwrap_or_default();
    let csec = data.paypal_secret.clone().unwrap_or_default();
    let token_res = client
        .post(format!("{}/v1/oauth2/token", data.paypal_base))
        .basic_auth(cid, Some(csec))
        .form(&[("grant_type", "client_credentials")])
        .send()
        .await;
    let token_res = match token_res {
        Ok(r) => r.json::<serde_json::Value>().await.unwrap_or_default(),
        Err(e) => return HttpResponse::BadGateway().json(serde_json::json!({ "error": format!("PayPal auth error: {e}") })),
    };
    let access = token_res.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let res = client
        .post(format!("{}/v2/checkout/orders/{}/capture", data.paypal_base, body.order_id))
        .bearer_auth(access)
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await;
    match res {
        Ok(r) => {
            let v: serde_json::Value = r.json().await.unwrap_or_default();
            let completed = v.get("status").and_then(|s| s.as_str()) == Some("COMPLETED");
            let status = if completed { "success" } else { "failed" };
            if let Err(e) = record_payment(
                &data.pool,
                user.id,
                "paypal",
                &body.order_id,
                usd_minor,
                "USD",
                status,
                Some(v.clone()),
            )
            .await
            {
                return db_error(e);
            }
            if completed {
                if let Err(e) = unlock(&data.pool, user.id, "paypal").await {
                    return db_error(e);
                }
                HttpResponse::Ok().json(serde_json::json!({ "ok": true, "has_access": true, "data": v }))
            } else {
                let paypal_status = v
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("UNKNOWN");
                let paypal_msg = v.get("message").and_then(|m| m.as_str()).unwrap_or("");
                HttpResponse::PaymentRequired().json(serde_json::json!({
                    "ok": false,
                    "error": format!(
                        "PayPal did not complete this order (status: {paypal_status}). {paypal_msg}"
                    ).trim().to_string(),
                    "data": v,
                }))
            }
        }
        Err(e) => HttpResponse::BadGateway().json(serde_json::json!({ "error": format!("PayPal error: {e}") })),
    }
}

// Demo unlock so the flow can be tried without real money
#[post("/api/dev/unlock")]
async fn dev_unlock(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    if !demo_mode(&data) {
        return HttpResponse::NotFound().json(serde_json::json!({ "error": "Not found." }));
    }
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if let Err(e) = record_payment(
        &data.pool,
        user.id,
        "demo",
        &format!("DEMO-{}", Uuid::new_v4()),
        0,
        "NGN",
        "success",
        Some(serde_json::json!({ "demo": true })),
    )
    .await
    {
        return db_error(e);
    }
    if let Err(e) = unlock(&data.pool, user.id, "demo").await {
        return db_error(e);
    }
    HttpResponse::Ok().json(serde_json::json!({ "ok": true, "has_access": true }))
}

#[derive(Deserialize)]
struct AdminSyncBody {
    chapter_id: String,
    kind: String, // "sample" or "full"
    storage_key: String,
    byte_size: Option<i64>,
}

#[derive(Deserialize)]
struct PresignUploadBody {

    chapter_id: String,
    kind: String,
    filename: String,
    content_type: String,
}

#[derive(Deserialize)]
struct PresignCoverBody {
    chapter_id: String,
    filename: String,
    content_type: String,
}
#[derive(Deserialize)]
struct UpdateChapterBody {
    title: Option<String>,
    blurb: Option<String>,
    minutes: Option<i32>,
    seconds: Option<i32>,
    duration_label: Option<String>,
}

#[derive(Deserialize)]
struct DeleteAudioBody {
    chapter_id: String,
    kind: String,
}

// Admin: list all files in Wasabi bucket under audiobooks/ prefix
#[get("/api/admin/wasabi/files")]
async fn admin_wasabi_files(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    let prefix = "audiobooks/";
    let mut files = Vec::new();
    let mut token: Option<String> = None;

    loop {
        let mut req = data.s3.list_objects_v2()
            .bucket(&data.wasabi_bucket)
            .prefix(prefix);
        if let Some(t) = token {
            req = req.continuation_token(t);
        }
        match req.send().await {
            Ok(output) => {
                if let Some(contents) = output.contents {
                    for obj in contents {
                        if let Some(key) = obj.key {
                            files.push(serde_json::json!({
                                "key": key,
                                "size": obj.size.unwrap_or(0),
                                "last_modified": obj.last_modified.map(|t| t.to_string()),
                            }));
                        }
                    }
                }
                token = output.next_continuation_token;
                if token.is_none() {
                    break;
                }
            }
            Err(e) => {
                log::error!("Wasabi list error: {e}");
                return HttpResponse::BadGateway().json(serde_json::json!({ "error": "Failed to list Wasabi files." }));
            }
        }
    }

    HttpResponse::Ok().json(serde_json::json!({ "files": files }))
}

// Admin: generate presigned URL for uploading to Wasabi
#[post("/api/admin/wasabi/presign-upload")]
async fn admin_presign_upload(req: HttpRequest, data: web::Data<AppState>, body: web::Json<PresignUploadBody>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    let key = format!("audiobooks/{}/{}/{}", body.chapter_id, body.kind, body.filename);
    
    let presigned = match data.s3.put_object()
        .bucket(&data.wasabi_bucket)
        .key(&key)
        .content_type(&body.content_type)
        .presigned(PresigningConfig::expires_in(StdDuration::from_secs(3600)).unwrap())
        .await
    {
        Ok(p) => p,
        Err(e) => {
            log::error!("Presign upload error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to generate presigned URL." }));
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "upload_url": presigned.uri(),
        "key": key,
        "expires_in": 3600
    }))
}

// Admin: sync Wasabi file to database (after upload)
#[post("/api/admin/audio-sync")]
async fn admin_audio_sync(req: HttpRequest, data: web::Data<AppState>, body: web::Json<AdminSyncBody>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    if body.kind != "sample" && body.kind != "full" {
        return HttpResponse::BadRequest().json(serde_json::json!({ "error": "kind must be 'sample' or 'full'" }));
    }

    let region = data.s3.config().region().unwrap().as_ref();
    let audio_url = format!("https://{}.s3.{}.wasabisys.com/{}", data.wasabi_bucket, region, body.storage_key);

    let res = sqlx::query(
        r#"
        INSERT INTO audio_files (chapter_id, kind, audio_url, storage_provider, storage_key, byte_size)
        VALUES ($1, $2, $3, 'wasabi', $4, $5)
        ON CONFLICT (chapter_id, kind) DO UPDATE SET
            audio_url = EXCLUDED.audio_url,
            storage_provider = EXCLUDED.storage_provider,
            storage_key = EXCLUDED.storage_key,
            byte_size = EXCLUDED.byte_size,
            updated_at = now()
        "#
    )
    .bind(&body.chapter_id)
    .bind(&body.kind)
    .bind(&audio_url)
    .bind(&body.storage_key)
    .bind(body.byte_size)
    .execute(&data.pool)
    .await;

    match res {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "ok": true })),
        Err(e) => db_error(e),
    }
}

// Admin: create a new chapter (with optional audio metadata)
#[derive(Deserialize)]
struct CreateChapterBody {
    title: String,
    blurb: Option<String>,
    minutes: Option<i32>,
    seconds: Option<i32>,
    duration_label: Option<String>,
    no: Option<i16>,
}

#[post("/api/admin/chapters")]
async fn admin_create_chapter(req: HttpRequest, data: web::Data<AppState>, body: web::Json<CreateChapterBody>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    let title = body.title.trim().to_string();
    if title.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({ "error": "Title is required." }));
    }

    let id = match unique_chapter_id(&data.pool, &title).await {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let no = body.no.unwrap_or(1);
    let blurb = body.blurb.clone().unwrap_or_default();
    let minutes = body.minutes.unwrap_or(0);
    let seconds = body.seconds.unwrap_or(0);
    let duration_label = body.duration_label.clone().unwrap_or_else(|| format!("{}:{:02}", minutes, seconds));

    // Compute next sort_order
    let sort_order: i32 = match sqlx::query_scalar::<_, i32>("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM chapters")
        .fetch_one(&data.pool).await
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };

    let res = sqlx::query(
        r#"
        INSERT INTO chapters (id, no, title, blurb, minutes, seconds, duration_label, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title, blurb = EXCLUDED.blurb, minutes = EXCLUDED.minutes,
            seconds = EXCLUDED.seconds, duration_label = EXCLUDED.duration_label,
            updated_at = now()
        "#,
    )
    .bind(&id)
    .bind(no)
    .bind(&title)
    .bind(&blurb)
    .bind(minutes)
    .bind(seconds)
    .bind(&duration_label)
    .bind(sort_order)
    .execute(&data.pool)
    .await;

    match res {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "ok": true, "id": id })),
        Err(e) => db_error(e),
    }
}

// Admin: presign cover image upload
#[post("/api/admin/cover/presign-upload")]
async fn admin_presign_cover(req: HttpRequest, data: web::Data<AppState>, body: web::Json<PresignCoverBody>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    let key = format!("audiobooks/{}/cover/{}", body.chapter_id, body.filename);
    let presigned = match data.s3.put_object()
        .bucket(&data.wasabi_bucket)
        .key(&key)
        .content_type(&body.content_type)
        .presigned(PresigningConfig::expires_in(StdDuration::from_secs(3600)).unwrap())
        .await
    {
        Ok(p) => p,
        Err(e) => {
            log::error!("Presign cover error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to generate presigned URL." }));
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "upload_url": presigned.uri(),
        "key": key,
        "expires_in": 3600
    }))
}

#[derive(Deserialize)]
struct CoverSyncBody {
    chapter_id: String,
    storage_key: String,
}

// Admin: sync cover image URL to chapter
#[post("/api/admin/cover-sync")]
async fn admin_cover_sync(req: HttpRequest, data: web::Data<AppState>, body: web::Json<CoverSyncBody>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    let region = data.s3.config().region().unwrap().as_ref();
    let cover_url = format!("https://{}.s3.{}.wasabisys.com/{}", data.wasabi_bucket, region, body.storage_key);

    let res = sqlx::query(
        "UPDATE chapters SET cover_image_url = $1, updated_at = now() WHERE id = $2",
    )
    .bind(&cover_url)
    .bind(&body.chapter_id)
    .execute(&data.pool)
    .await;

    match res {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "ok": true })),
        Err(e) => db_error(e),
    }
}

// Admin: list chapters with audio status
#[get("/api/admin/chapters")]
async fn admin_chapters(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    let chapters = match sqlx::query_as::<_, ChapterRow>(
        "SELECT c.id, c.no, c.title, c.blurb, c.minutes, c.duration_label, c.cover_image_url,
                s.audio_url AS sample_url, s.storage_key AS sample_key,
                f.audio_url AS full_url, f.storage_key AS full_key
         FROM chapters c
         LEFT JOIN audio_files s ON s.chapter_id = c.id AND s.kind = 'sample'
         LEFT JOIN audio_files f ON f.chapter_id = c.id AND f.kind = 'full'
         ORDER BY c.sort_order"
    )
    .fetch_all(&data.pool)
    .await {
        Ok(r) => r,
        Err(e) => return db_error(e),
    };

    HttpResponse::Ok().json(serde_json::json!({ "chapters": chapters }))
}

// Admin: update chapter metadata
#[put("/api/admin/chapters/{id}")]
async fn admin_update_chapter(req: HttpRequest, data: web::Data<AppState>, path: web::Path<String>, body: web::Json<UpdateChapterBody>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    let id = path.into_inner();
    let mut query = "UPDATE chapters SET updated_at = now()".to_string();
    let mut param_idx = 1;

    if body.title.is_some() {
        query.push_str(&format!(", title = ${}", param_idx));
        param_idx += 1;
    }
    if body.blurb.is_some() {
        query.push_str(&format!(", blurb = ${}", param_idx));
        param_idx += 1;
    }
    if body.minutes.is_some() {
        query.push_str(&format!(", minutes = ${}", param_idx));
        param_idx += 1;
    }
    if body.seconds.is_some() {
        query.push_str(&format!(", seconds = ${}", param_idx));
        param_idx += 1;
    }
    if body.duration_label.is_some() {
        query.push_str(&format!(", duration_label = ${}", param_idx));
        param_idx += 1;
    }

    query.push_str(&format!(" WHERE id = ${}", param_idx));

    let mut q = sqlx::query(&query);
    if let Some(v) = &body.title { q = q.bind(v); }
    if let Some(v) = &body.blurb { q = q.bind(v); }
    if let Some(v) = body.minutes { q = q.bind(v); }
    if let Some(v) = body.seconds { q = q.bind(v); }
    if let Some(v) = &body.duration_label { q = q.bind(v); }
    q = q.bind(&id);

    match q.execute(&data.pool).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "ok": true })),
        Err(e) => db_error(e),
    }
}

// Admin: delete a chapter and everything attached to it (DB rows + stored files)
#[delete("/api/admin/chapters/{id}")]
async fn admin_delete_chapter(req: HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    let id = path.into_inner();

    // Every stored object for this chapter: its audio files plus its cover.
    let mut keys: Vec<String> = match sqlx::query_scalar::<_, String>(
        "SELECT storage_key FROM audio_files WHERE chapter_id = $1 AND storage_key IS NOT NULL AND storage_key <> ''",
    )
    .bind(&id)
    .fetch_all(&data.pool)
    .await
    {
        Ok(k) => k,
        Err(e) => return db_error(e),
    };

    let cover: Option<String> =
        match sqlx::query_scalar::<_, String>("SELECT cover_image_url FROM chapters WHERE id = $1")
            .bind(&id)
            .fetch_optional(&data.pool)
            .await
        {
            Ok(c) => c,
            Err(e) => return db_error(e),
        };
    if let Some(key) = cover.as_deref().and_then(key_from_cover_url) {
        keys.push(key);
    }

    // Best-effort storage cleanup; the DB rows go regardless so the catalogue
    // never points at files we tried to remove.
    for key in &keys {
        if let Err(e) = data
            .s3
            .delete_object()
            .bucket(&data.wasabi_bucket)
            .key(key)
            .send()
            .await
        {
            log::warn!("Failed to delete Wasabi object {key}: {e}");
        }
    }

    // Deleting the chapter cascades to its audio_files rows.
    match sqlx::query("DELETE FROM chapters WHERE id = $1")
        .bind(&id)
        .execute(&data.pool)
        .await
    {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "ok": true })),
        Err(e) => db_error(e),
    }
}

// Admin: delete audio file
#[delete("/api/admin/audio")]
async fn admin_delete_audio(req: HttpRequest, data: web::Data<AppState>, body: web::Json<DeleteAudioBody>) -> impl Responder {
    let user = match auth_user(&req, &data).await {
        Ok(Some(u)) => u,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })),
        Err(e) => return db_error(e),
    };
    if !is_admin(&user, &data.admin_emails) {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." }));
    }

    // Look up the stored object key before touching the database so we can
    // remove the file from object storage as well as the record.
    let storage_key: Option<String> = match sqlx::query_scalar::<_, Option<String>>(
        "SELECT storage_key FROM audio_files WHERE chapter_id = $1 AND kind = $2",
    )
    .bind(&body.chapter_id)
    .bind(&body.kind)
    .fetch_optional(&data.pool)
    .await
    {
        Ok(Some(k)) => k,
        Ok(None) => None,
        Err(e) => return db_error(e),
    };

    // Best-effort delete from Wasabi; still clear the DB row if storage fails
    // so the catalogue never points at a file we tried to remove.
    if let Some(key) = storage_key.as_deref().filter(|k| !k.is_empty()) {
        if let Err(e) = data
            .s3
            .delete_object()
            .bucket(&data.wasabi_bucket)
            .key(key)
            .send()
            .await
        {
            log::warn!("Failed to delete Wasabi object {key}: {e}");
        }
    }

    let res = if body.kind == "cover" {
        sqlx::query("UPDATE chapters SET cover_image_url = NULL, updated_at = now() WHERE id = $1")
            .bind(&body.chapter_id)
            .execute(&data.pool)
            .await
    } else {
        sqlx::query("DELETE FROM audio_files WHERE chapter_id = $1 AND kind = $2")
            .bind(&body.chapter_id)
            .bind(&body.kind)
            .execute(&data.pool)
            .await
    };

    match res {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "ok": true })),
        Err(e) => db_error(e),
    }
}

// Admin: upload a file (cover or full audio) directly to Wasabi via the SDK.
// Presigned URLs don't validate against Wasabi's endpoint, so the browser
// uploads through us instead — one multipart request, one signed PUT, one sync.
#[post("/api/admin/upload")]
async fn admin_upload(
    req: HttpRequest,
    data: web::Data<AppState>,
    payload: web::Payload,
) -> Result<HttpResponse, actix_multipart::MultipartError> {
    let Ok(user) = auth_user(&req, &data).await else {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })));
    };
    let Some(user) = user else {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." })));
    };
    if !is_admin(&user, &data.admin_emails) {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required." })));
    }

    let mut chapter_id: Option<String> = None;
    let mut kind: Option<String> = None;
    let mut filename: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut file_bytes: Vec<u8> = Vec::new();

    let mut multipart = actix_multipart::Multipart::new(req.headers(), payload);
    while let Some(mut field) = multipart.try_next().await? {
        let name = field
            .content_disposition()
            .and_then(|d| d.get_name())
            .unwrap_or("")
            .to_string();
        let field_content_type = field.content_type().map(|m| m.to_string());
        let field_filename = field
            .content_disposition()
            .and_then(|d| d.get_filename())
            .map(|s| s.to_string());
        let mut buf = Vec::new();
        while let Some(chunk) = field.try_next().await? {
            buf.extend_from_slice(&chunk);
        }
        match name.as_str() {
            "chapter_id" => chapter_id = Some(String::from_utf8_lossy(&buf).trim().to_string()),
            "kind" => kind = Some(String::from_utf8_lossy(&buf).trim().to_string()),
            "file" => {
                file_bytes = buf;
                content_type = field_content_type;
                filename = field_filename;
            }
            _ => {}
        }
    }

    let Some(chapter_id) = chapter_id else {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({ "error": "chapter_id is required." })));
    };
    let Some(kind) = kind else {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({ "error": "kind is required." })));
    };
    if kind != "cover" && kind != "full" {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({ "error": "kind must be 'cover' or 'full'." })));
    }
    if file_bytes.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({ "error": "The file part is required and must not be empty." })));
    }

    let filename = filename
        .map(|f| f.replace(['/', '\\', '\0'], "-"))
        .filter(|f| !f.is_empty())
        .unwrap_or_else(|| format!("file-{}", std::process::id()));
    let extension = filename.rsplit('.').next().unwrap_or("");
    let default_ct = if kind == "cover" {
        match extension.to_lowercase().as_str() {
            "png" => "image/png",
            "webp" => "image/webp",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            _ => "image/jpeg",
        }
    } else {
        "audio/mpeg"
    };
    let content_type = content_type.unwrap_or_else(|| default_ct.to_string());

    let key = if kind == "cover" {
        format!("audiobooks/{chapter_id}/cover/{filename}")
    } else {
        format!("audiobooks/{chapter_id}/full/{filename}")
    };

    if let Err(e) = data
        .s3
        .put_object()
        .bucket(&data.wasabi_bucket)
        .key(&key)
        .content_type(&content_type)
        .body(file_bytes.clone().into())
        .send()
        .await
    {
        log::error!("Upload to Wasabi failed: {e}");
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to store the file." })));
    }

    let region = data.s3.config().region().unwrap().as_ref();
    let url = format!("https://{}.s3.{}.wasabisys.com/{}", data.wasabi_bucket, region, key);

    if kind == "cover" {
        match sqlx::query(
            "UPDATE chapters SET cover_image_url = $1, updated_at = now() WHERE id = $2",
        )
        .bind(&url)
        .bind(&chapter_id)
        .execute(&data.pool)
        .await
        {
            Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({ "ok": true, "key": key }))),
            Err(e) => Ok(db_error(e)),
        }
    } else {
        match sqlx::query(
            r#"
            INSERT INTO audio_files (chapter_id, kind, audio_url, storage_provider, storage_key, byte_size)
            VALUES ($1, 'full', $2, 'wasabi', $3, $4)
            ON CONFLICT (chapter_id, kind) DO UPDATE SET
                audio_url = EXCLUDED.audio_url,
                storage_provider = EXCLUDED.storage_provider,
                storage_key = EXCLUDED.storage_key,
                byte_size = EXCLUDED.byte_size,
                updated_at = now()
            "#,
        )
        .bind(&chapter_id)
        .bind(&url)
        .bind(&key)
        .bind(file_bytes.len() as i64)
        .execute(&data.pool)
        .await
        {
            Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({ "ok": true, "key": key }))),
            Err(e) => Ok(db_error(e)),
        }
    }
}

/// Extract the Wasabi object key from a stored `https://…wasabisys.com/{key}` URL.
fn key_from_cover_url(url: &str) -> Option<String> {
    let marker = ".wasabisys.com/";
    let idx = url.find(marker)?;
    let key = url[idx + marker.len()..].split('?').next().unwrap_or("");
    if key.is_empty() {
        None
    } else {
        Some(key.to_string())
    }
}

/// Stream a stored object straight from Wasabi (presigned URLs are rejected by
/// this endpoint, so we proxy reads through the backend too). Supports HTTP
/// Range requests so the player can seek, and sets cache headers so the browser
/// keeps the audio locally after the first play.
async fn stream_object(
    data: &web::Data<AppState>,
    key: &str,
    fallback_content_type: &str,
    range: Option<String>,
) -> HttpResponse {
    let mut get = data.s3.get_object().bucket(&data.wasabi_bucket).key(key);
    if let Some(r) = range.as_ref() {
        get = get.range(r.clone());
    }

    match get.send().await {
        Ok(resp) => {
            let ct = resp.content_type().unwrap_or(fallback_content_type).to_string();
            let partial = range.is_some() && resp.content_range().is_some();
            let status = if partial {
                actix_web::http::StatusCode::PARTIAL_CONTENT
            } else {
                actix_web::http::StatusCode::OK
            };
            let mut builder = HttpResponse::build(status);
            builder.content_type(ct);
            builder.append_header(("Accept-Ranges", "bytes"));
            builder.append_header(("Cache-Control", "private, max-age=86400"));
            if let Some(cr) = resp.content_range() {
                builder.append_header(("Content-Range", cr.to_string()));
            }
            if let Some(etag) = resp.e_tag() {
                builder.append_header(("ETag", etag.to_string()));
            }
            if let Some(len) = resp.content_length() {
                builder.no_chunking(len as u64);
            }
            let reader = tokio_util::io::ReaderStream::new(resp.body.into_async_read());
            builder.streaming(reader)
        }
        Err(e) => {
            log::error!("Stream from Wasabi failed: {e}");
            HttpResponse::NotFound().json(serde_json::json!({ "error": "File not found in storage." }))
        }
    }
}

fn request_range(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get(actix_web::http::header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

// Stream full audio to an authorized listener.
#[get("/api/audio/{id}/stream")]
async fn audio_stream(req: HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let Some(token) = token_from_request(&req) else {
        return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in to listen." }));
    };
    let user = match auth_token(&token, &data).await {
        Ok(u) => u,
        Err(e) => return db_error(e),
    };
    match user {
        Some(u) if u.has_access => {}
        Some(_) => return HttpResponse::PaymentRequired().json(serde_json::json!({
            "error": "Locked. Complete payment to unlock this chapter.",
            "code": "LOCKED"
        })),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in to listen." })),
    }

    let key: Option<String> = match sqlx::query_scalar::<_, String>(
        "SELECT storage_key FROM audio_files WHERE chapter_id = $1 AND kind = 'full'",
    )
    .bind(&id)
    .fetch_optional(&data.pool)
    .await
    {
        Ok(k) => k,
        Err(e) => return db_error(e),
    };
    let Some(key) = key else {
        return HttpResponse::NotFound().json(serde_json::json!({ "error": "No audio file is attached to this chapter yet." }));
    };

    stream_object(&data, &key, "audio/mpeg", request_range(&req)).await
}

// Stream a chapter cover image to any logged-in user.
#[get("/api/cover/{id}")]
async fn cover_image(req: HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let Some(token) = token_from_request(&req) else {
        return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." }));
    };
    let user = match auth_token(&token, &data).await {
        Ok(u) => u,
        Err(e) => return db_error(e),
    };
    if user.is_none() {
        return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in first." }));
    }

    let cover_url: Option<String> = match sqlx::query_scalar::<_, String>(
        "SELECT cover_image_url FROM chapters WHERE id = $1",
    )
    .bind(&id)
    .fetch_optional(&data.pool)
    .await
    {
        Ok(c) => c,
        Err(e) => return db_error(e),
    };
    let Some(cover_url) = cover_url else {
        return HttpResponse::NotFound().json(serde_json::json!({ "error": "This chapter has no cover image yet." }));
    };
    let Some(key) = key_from_cover_url(&cover_url) else {
        return HttpResponse::NotFound().json(serde_json::json!({ "error": "Cover image key not found." }));
    };

    stream_object(&data, &key, "image/jpeg", None).await
}

// Updated audio endpoint: point the client at the backend stream route
// (presigned Wasabi GETs are rejected, so we proxy reads as well).
#[get("/api/audio/{id}")]
async fn audio(req: HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let rows = match load_chapters(&data.pool).await {
        Ok(r) => r,
        Err(e) => return db_error(e),
    };
    let Some(chapter) = rows.iter().find(|c| c.id == id) else {
        return HttpResponse::NotFound().json(serde_json::json!({ "error": "Chapter not found." }));
    };
    let Some(_url) = chapter.full_url.clone() else {
        return HttpResponse::NotFound()
            .json(serde_json::json!({ "error": "No audio file is attached to this chapter yet." }));
    };

    match auth_user(&req, &data).await {
        Ok(Some(u)) if u.has_access => {
            // Point the player at our own stream route — reads are proxied through
            // the backend with direct SDK GETs (presigned Wasabi URLs are rejected).
            let conn = req.connection_info();
            let scheme = conn.scheme();
            let host = conn.host();
            let token = token_from_request(&req).unwrap_or_default();
            let stream_url = format!("{scheme}://{host}/api/audio/{}/stream?token={}", id, token);

            HttpResponse::Ok().json(serde_json::json!({
                "id": chapter.id, "title": chapter.title, "audio_url": stream_url, "free": false
            }))
        }
        Ok(Some(_)) => HttpResponse::PaymentRequired().json(serde_json::json!({
            "error": "Locked. Complete payment to unlock this chapter.",
            "code": "LOCKED"
        })),
        Ok(None) => HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Log in to listen." })),
        Err(e) => db_error(e),
    }
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init();

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        log::error!("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
        std::process::exit(1);
    });

    // Neon (and other serverless Postgres) can be suspended and take a while to
    // wake. Retry the initial connection instead of panicking on a cold start.
    let mut attempt = 0;
    let pool = loop {
        attempt += 1;
        match PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(StdDuration::from_secs(30))
            .connect(&database_url)
            .await
        {
            Ok(p) => break p,
            Err(e) if attempt < 10 => {
                log::warn!("Database connect attempt {attempt} failed ({e}); retrying in 3s…");
                tokio::time::sleep(StdDuration::from_secs(3)).await;
            }
            Err(e) => {
                log::error!("Could not connect to DATABASE_URL after {attempt} attempts: {e}");
                std::process::exit(1);
            }
        }
    };

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("run migrations");

    // Initialize Wasabi S3 client
    let wasabi_bucket = std::env::var("WASABI_BUCKET").unwrap_or_else(|_| "dreamjobmadeeasy".into());
    let wasabi_region = std::env::var("WASABI_REGION").unwrap_or_else(|_| "us-west-1".into());
    let wasabi_endpoint = std::env::var("WASABI_ENDPOINT").unwrap_or_else(|_| "https://s3.us-west-1.wasabisys.com".into());
    let wasabi_access_key = std::env::var("WASABI_ACCESS_KEY").unwrap_or_default();
    let wasabi_secret_key = std::env::var("WASABI_SECRET_KEY").unwrap_or_default();

    let s3_config = S3ConfigBuilder::new()
        .region(Region::new(wasabi_region))
        .endpoint_url(wasabi_endpoint)
        .credentials_provider(aws_sdk_s3::config::Credentials::new(
            wasabi_access_key,
            wasabi_secret_key,
            None,
            None,
            "wasabi",
        ))
        .behavior_version(BehaviorVersion::latest())
        .build();
    let s3 = S3Client::from_conf(s3_config);

    // Admin emails (comma-separated)
    let admin_emails: Vec<String> = std::env::var("ADMIN_EMAILS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let state = web::Data::new(AppState {
        pool,
        jwt_secret: std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into()),
        frontend_url: std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".into()),
        paystack_secret: std::env::var("PAYSTACK_SECRET_KEY").ok(),
        paypal_client_id: std::env::var("PAYPAL_CLIENT_ID").ok(),
        paypal_secret: std::env::var("PAYPAL_CLIENT_SECRET").ok(),
        paypal_base: std::env::var("PAYPAL_BASE_URL")
            .unwrap_or_else(|_| "https://api-m.sandbox.paypal.com".into()),
        price_ngn_kobo: std::env::var("PRICE_NGN_KOBO").ok().and_then(|v| v.parse().ok()).unwrap_or(850000),
        price_usd: std::env::var("PRICE_USD").unwrap_or_else(|_| "19.00".into()),
        payments_demo_mode: std::env::var("PAYMENTS_DEMO_MODE")
            .map(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
            .unwrap_or(false),
        s3,
        wasabi_bucket,
        admin_emails,
    });

    println!("DreamJobMadeEasy API on http://0.0.0.0:{port}");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        App::new()
            .wrap(cors)
            .wrap(actix_web::middleware::Logger::default())
            .app_data(state.clone())
            .service(health)
            .service(signup)
            .service(login)
            .service(me)
            .service(book)
            .service(audio)
            .service(audio_stream)
            .service(cover_image)
            .service(paystack_init)
            .service(paystack_verify)
            .service(paypal_create)
            .service(paypal_capture)
            .service(dev_unlock)
            .service(admin_wasabi_files)
            .service(admin_presign_upload)
            .service(admin_audio_sync)
            .service(admin_chapters)
            .service(admin_create_chapter)
            .service(admin_update_chapter)
            .service(admin_delete_chapter)
            .service(admin_presign_cover)
            .service(admin_cover_sync)
            .service(admin_delete_audio)
            .service(admin_upload)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
