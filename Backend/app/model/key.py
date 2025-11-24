from pydantic import BaseModel

class KeyModel(BaseModel):
    dek: str
    provider_name: str
    userid: str   

class APIKeyIn(BaseModel):
    api_key: str
    provider_name: str