"""
handles parsing commands from command bar
"""

from app.core.ml.intent_classsifier import IntentSimilarityModel
from app.schemas.base_command import BaseCommand, MatchResult, CommandResult

class CommandRouter:
    def __init__(self, model: IntentSimilarityModel, confidence_threshold: float = 0.7):
        self.plugins: list[BaseCommand] = []
        self.classifier = model
        self.confidence_threshold = confidence_threshold
        self._built = False

    def register_plugin(self, plugin: BaseCommand) -> None:
        """
        registers a plugin with the command router
        """
        if not isinstance(plugin, BaseCommand):
            print(f"Plugin {plugin} is not a subclass of BaseCommand") 
            return
        self.plugins.append(plugin)
        self._built = False

    def _ensure_built(self):
        if not self._built:
            self.classifier.build(self.plugins)
            self._built = True

    async def process(self, raw: str) -> Optional[MatchResult]:
        """
        takes in raw command string
        called by api
        """
        if not raw or not raw.strip():
            return CommandResult(
                success=False,
                action='EMPTY',
                response_text="Nothing to process",
                data={}
            )
        
        raw = raw.strip()
        self._ensure_built()

        match = await self.classifier.classify(raw)

        if not match or match.confidence < self.confidence_threshold:
            # try plugins one by one
            tokens = raw.split()
            return CommandResult(
                success=False,
                action='NO_MATCH',
                response_text="No matching command found",
                data={}
            )

        plugin = self._get_plugin(match.plugin)
        if not plugin:
            return CommandResult(
                success=False,
                action='PLUGIN_NOT_FOUND',
                response_text=f"Plugin {match.plugin} not found",
                data={}
            )

        try:
            return await plugin.handle(match.intent, match.extracted, raw)
        except Exception as e:
            return CommandResult(
                success=False,
                action='PLUGIN_ERROR',
                response_text=f"Error in plugin {match.plugin}: {str(e)}",
                data={}
            )

    def _get_plugin(self, name: str) -> Optional[BasePlugin]:
        """
        returns plugin object by name
        """
        for plugin in self.plugins:
            try:
                if plugin.name == name:
                    return plugin
            except AttributeError:
                continue
        return None

router = CommandRouter(model=IntentSimilarityModel())