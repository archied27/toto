from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from app.schemas.base_command import BaseCommand, MatchResult

class IntentSimilarityModel:
    def __init__(self,):
        self.model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    def build(self, plugins: list[BaseCommand]):
        self.catalog = [(p.name, spec.name, ex, spec.command_name)
                         for p in plugins for spec in p.get_intents() for ex in spec.examples]
        self.embeddings = self.model.encode([c[2] for c in self.catalog])

    async def classify(self, raw: str) -> Optional[MatchResult]:
        vec = self.model.encode([raw])[0]
        sims = cosine_similarity([vec], self.embeddings)[0]
        idx = sims.argmax()
        plugin, intent, _, intent_name = self.catalog[idx]
        return MatchResult(intent=intent, confidence=float(sims[idx]), extracted={}, plugin=plugin, intent_name=intent_name)