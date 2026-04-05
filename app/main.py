# app/main.py
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.routers.auth import router as auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

SWAGGER_DARK_CSS = """
body { background: #0f1117 !important; }
.swagger-ui { background: #0f1117; color: #e2e8f0; }
.swagger-ui .topbar { background: #1a1d27; border-bottom: 1px solid #2d3148; }
.swagger-ui .topbar .download-url-wrapper input[type=text] {
    background: #252837; color: #e2e8f0; border: 1px solid #3d4166;
}
.swagger-ui .info .title { color: #a78bfa; }
.swagger-ui .info p, .swagger-ui .info li, .swagger-ui .info table { color: #cbd5e1; }
.swagger-ui .scheme-container { background: #1a1d27; box-shadow: none; border-bottom: 1px solid #2d3148; }
.swagger-ui select { background: #252837; color: #e2e8f0; border: 1px solid #3d4166; }
.swagger-ui .opblock-tag { color: #a78bfa; border-bottom: 1px solid #2d3148; }
.swagger-ui .opblock-tag:hover { background: #1e2133; }
.swagger-ui .opblock { background: #1a1d27; border: 1px solid #2d3148; box-shadow: none; }
.swagger-ui .opblock .opblock-summary { border-bottom: 1px solid #2d3148; }
.swagger-ui .opblock .opblock-summary-path { color: #e2e8f0; }
.swagger-ui .opblock .opblock-summary-description { color: #94a3b8; }
.swagger-ui .opblock.opblock-get    { border-left: 3px solid #38bdf8; background: #0f1f2e; }
.swagger-ui .opblock.opblock-post   { border-left: 3px solid #4ade80; background: #0f2e1a; }
.swagger-ui .opblock.opblock-put    { border-left: 3px solid #fb923c; background: #2e1f0f; }
.swagger-ui .opblock.opblock-patch  { border-left: 3px solid #facc15; background: #2e2a0f; }
.swagger-ui .opblock.opblock-delete { border-left: 3px solid #f87171; background: #2e0f0f; }
.swagger-ui .opblock-body { background: #13151f; }
.swagger-ui .opblock-description-wrapper p,
.swagger-ui .opblock-external-docs-wrapper p,
.swagger-ui .opblock-title_normal p { color: #cbd5e1; }
.swagger-ui .opblock-summary-method { font-weight: 700; border-radius: 4px; min-width: 70px; text-align: center; }
.swagger-ui .parameters-col_description p { color: #cbd5e1; }
.swagger-ui table thead tr td,
.swagger-ui table thead tr th { color: #94a3b8; border-bottom: 1px solid #2d3148; }
.swagger-ui .parameter__name { color: #e2e8f0; }
.swagger-ui .parameter__type { color: #a78bfa; }
.swagger-ui .parameter__in   { color: #38bdf8; }
.swagger-ui input[type=text],
.swagger-ui input[type=password],
.swagger-ui textarea {
    background: #252837 !important; color: #e2e8f0 !important;
    border: 1px solid #3d4166 !important;
}
.swagger-ui input[type=text]:focus,
.swagger-ui textarea:focus { border-color: #a78bfa !important; outline: none !important; }
.swagger-ui .btn { color: #e2e8f0; border-color: #3d4166; background: #252837; }
.swagger-ui .btn:hover { background: #2d3148; }
.swagger-ui .btn.execute { background: #a78bfa; border-color: #a78bfa; color: #0f1117; font-weight: 700; }
.swagger-ui .btn.execute:hover { background: #9061f9; }
.swagger-ui .btn.cancel  { background: #f87171; border-color: #f87171; color: #0f1117; }
.swagger-ui .btn.authorize { background: #4ade80; border-color: #4ade80; color: #0f1117; font-weight: 700; }
.swagger-ui .responses-inner { background: #13151f; }
.swagger-ui .response-col_status  { color: #4ade80; }
.swagger-ui .response-col_links   { color: #38bdf8; }
.swagger-ui table.responses-table tbody tr td { border-bottom: 1px solid #2d3148; }
.swagger-ui .highlight-code,
.swagger-ui pre { background: #0a0c14 !important; color: #e2e8f0 !important; border: 1px solid #2d3148; }
.swagger-ui .microlight { background: #0a0c14; color: #e2e8f0; }
.swagger-ui section.models { background: #1a1d27; border: 1px solid #2d3148; }
.swagger-ui section.models h4 { color: #a78bfa; }
.swagger-ui .model-title { color: #e2e8f0; }
.swagger-ui .model { color: #cbd5e1; }
.swagger-ui .model-toggle:after { filter: invert(1); }
.swagger-ui .dialog-ux .modal-ux { background: #1a1d27; border: 1px solid #3d4166; color: #e2e8f0; }
.swagger-ui .dialog-ux .modal-ux-header { background: #13151f; border-bottom: 1px solid #2d3148; }
.swagger-ui .dialog-ux .modal-ux-header h3 { color: #a78bfa; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0f1117; }
::-webkit-scrollbar-thumb { background: #3d4166; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #a78bfa; }
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Scheduler ────────────────────────────────────────────────────────────
    from app.services.scheduler import create_scheduler
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("Scheduler iniciado — lineup_control (1min), pricing (30min).")

    logger.info("XAMA Fantasy API iniciada.")
    yield

    scheduler.shutdown(wait=False)
    logger.info("Scheduler encerrado. XAMA Fantasy API encerrando.")


app = FastAPI(
    title="XAMA Fantasy API",
    description="Backend da plataforma de Fantasy PUBG — XAMA Fantasy",
    version="3.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Swagger dark mode ─────────────────────────────────────────────────────────
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui() -> HTMLResponse:
    return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head>
  <title>XAMA Fantasy API</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>{SWAGGER_DARK_CSS}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({{
      url: "/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      persistAuthorization: true,
      syntaxHighlight: {{ theme: "monokai" }}
    }})
  </script>
</body>
</html>""")


# ── Routers ───────────────────────────────────────────────────────────────────
# Fase 2+ — adicionar routers aqui conforme forem criados
app.include_router(auth_router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "XAMA Fantasy API", "version": "3.0.0"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
