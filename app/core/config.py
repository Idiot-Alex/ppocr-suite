from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PP-OCRv6 API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    ocr_lang: str = "ch"
    ocr_preload_on_startup: bool = True
    ocr_include_raw_by_default: bool = False

    max_upload_size_mb: int = 10
    api_keys: str = "ppocr-dev-7c9f2b8a6e1d4c30"
    api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def valid_api_keys(self) -> frozenset[str]:
        keys = [key.strip() for key in self.api_keys.split(",")]
        if self.api_key:
            keys.append(self.api_key.strip())
        return frozenset(key for key in keys if key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
