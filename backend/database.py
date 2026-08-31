from supabase import create_client, Client
import os

_client: Client | None = None

def get_db() -> Client:
    global _client
    if _client is None:
        _client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    return _client
