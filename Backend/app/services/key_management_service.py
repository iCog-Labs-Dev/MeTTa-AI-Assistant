from cryptography.fernet import Fernet
from pymongo.database import Database
from app.db.key import insert_dek, get_dek, get_api_provider, delete_api_key

class KMS:
    """Key Management Service wrapping KEK."""

    def __init__(self, KEK: str):
        self.f = Fernet(KEK)

    async def encrypt_and_store(self, userid: str, provider_name: str, api_key: str, mongo_db: Database):
        """
        Encrypt and store api key
        Returns (persist_success: bool, encrypted_api_key_bytes).
        """

        DEK = Fernet.generate_key()  
        fernet_dek = Fernet(DEK)
        encrypted_api_key = fernet_dek.encrypt(api_key.encode()).decode("utf-8")
        encrypted_dek = self.f.encrypt(DEK).decode("utf-8")

        key_dict = {"userid": userid, "dek": encrypted_dek, "provider_name": provider_name}
        generated = await insert_dek(key_dict, mongo_db)
        return generated, encrypted_api_key

    async def decrypt_api_key(self, encrypted_api_key: str, userid: str, provider_name: str, mongo_db: Database):
        """Decrypt stored encrypted_api_key."""

        encrypted_DEK = await get_dek(provider_name, userid, mongo_db)
        if encrypted_DEK is None:
            raise ValueError("DEK not found for given service/user")

        DEK = self.f.decrypt(encrypted_DEK.encode())  
        fernet_dek = Fernet(DEK)
        api_key = fernet_dek.decrypt(encrypted_api_key.encode()).decode("utf-8")
        return api_key

    async def get_api_provider(self, userid: str, mongo_db: Database):
        services = await get_api_provider(userid, mongo_db)
        return services if services else []

    async def delete_api_key(self, userid: str, provider_name: str, mongo_db: Database):
        return await delete_api_key(userid, provider_name, mongo_db)

