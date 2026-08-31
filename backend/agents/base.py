import os, json, re
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference


class GraniteAgent:
    def __init__(self, system_prompt: str, model_id: str = "ibm/granite-3-8b-instruct"):
        api_key = os.environ.get("WATSONX_API_KEY")
        if not api_key:
            raise EnvironmentError("WATSONX_API_KEY is not set")
        self.system_prompt = system_prompt
        self.model = ModelInference(
            model_id=model_id,
            credentials=Credentials(
                api_key=api_key,
                url=os.environ.get("WATSONX_URL", "https://us-south.ml.cloud.ibm.com"),
            ),
            project_id=os.environ["WATSONX_PROJECT_ID"],
            params={"max_new_tokens": 2048, "temperature": 0.0},
        )

    def call(self, user_message: str, retries: int = 3) -> dict:
        """Call the model, retry on JSON parse failure. Always returns a dict."""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user",   "content": user_message},
        ]
        last_err = None
        for attempt in range(retries):
            try:
                raw = self.model.chat(messages=messages)
                text = raw["choices"][0]["message"]["content"].strip()
                # Strip markdown code fences if present
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)
                return json.loads(text)
            except (json.JSONDecodeError, KeyError) as e:
                last_err = e
                continue
            except Exception as e:
                raise RuntimeError(f"watsonx.ai call failed: {e}") from e
        raise ValueError(f"Model returned invalid JSON after {retries} attempts: {last_err}")
