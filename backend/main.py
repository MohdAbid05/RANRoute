from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import customers as customers_router
from routers import agents as agents_router
from routers import set_routes as set_routes_router
from routers import solver as solver_router
from routers import route_runs as route_runs_router

app = FastAPI(title="RANRoute Everywhere API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers_router.router, prefix="/customers", tags=["customers"])
app.include_router(agents_router.router, prefix="/agents", tags=["agents"])
app.include_router(set_routes_router.router, prefix="/set-routes", tags=["set-routes"])
app.include_router(solver_router.router, prefix="/solver", tags=["solver"])
app.include_router(route_runs_router.router, prefix="/route-runs", tags=["route-runs"])


@app.get("/health")
def health():
    return {"status": "ok"}
