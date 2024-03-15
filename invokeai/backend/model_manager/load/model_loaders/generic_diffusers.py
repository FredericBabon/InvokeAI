# Copyright (c) 2024, Lincoln D. Stein and the InvokeAI Development Team
"""Class for simple diffusers model loading in InvokeAI."""

import sys
from pathlib import Path
from typing import Any, Optional

from diffusers.configuration_utils import ConfigMixin
from diffusers.models.modeling_utils import ModelMixin

from invokeai.backend.model_manager import (
    AnyModelConfig,
    BaseModelType,
    InvalidModelConfigException,
    ModelFormat,
    ModelType,
    SubModelType,
)
from invokeai.backend.model_manager.any_model_type import AnyModel
from invokeai.backend.model_manager.config import DiffusersConfigBase

from .. import ModelLoader, ModelLoaderRegistry


@ModelLoaderRegistry.register(base=BaseModelType.Any, type=ModelType.CLIPVision, format=ModelFormat.Diffusers)
@ModelLoaderRegistry.register(base=BaseModelType.Any, type=ModelType.T2IAdapter, format=ModelFormat.Diffusers)
class GenericDiffusersLoader(ModelLoader):
    """Class to load simple diffusers models."""

    def _load_model(
        self,
        config: AnyModelConfig,
        submodel_type: Optional[SubModelType] = None,
    ) -> AnyModel:
        model_path = Path(config.path)
        model_class = self.get_hf_load_class(model_path)
        if submodel_type is not None:
            raise Exception(f"There are no submodels in models of type {model_class}")
        repo_variant = config.repo_variant if isinstance(config, DiffusersConfigBase) else None
        variant = repo_variant.value if repo_variant else None
        try:
            result: AnyModel = model_class.from_pretrained(model_path, torch_dtype=self._torch_dtype, variant=variant)
        except OSError as e:
            if variant and "no file named" in str(
                e
            ):  # try without the variant, just in case user's preferences changed
                result = model_class.from_pretrained(model_path, torch_dtype=self._torch_dtype)
            else:
                raise e
        return result

    # TO DO: Add exception handling
    def get_hf_load_class(self, model_path: Path, submodel_type: Optional[SubModelType] = None) -> ModelMixin:
        """Given the model path and submodel, returns the diffusers ModelMixin subclass needed to load."""
        result = None
        if submodel_type:
            try:
                config = self._load_diffusers_config(model_path, config_name="model_index.json")
                module, class_name = config[submodel_type.value]
                result = self._hf_definition_to_type(module=module, class_name=class_name)
            except KeyError as e:
                raise InvalidModelConfigException(
                    f'The "{submodel_type}" submodel is not available for this model.'
                ) from e
        else:
            try:
                config = self._load_diffusers_config(model_path, config_name="config.json")
                class_name = config.get("_class_name", None)
                if class_name:
                    result = self._hf_definition_to_type(module="diffusers", class_name=class_name)
                if config.get("model_type", None) == "clip_vision_model":
                    class_name = config.get("architectures")
                    assert class_name is not None
                    result = self._hf_definition_to_type(module="transformers", class_name=class_name[0])
                if not class_name:
                    raise InvalidModelConfigException("Unable to decipher Load Class based on given config.json")
            except KeyError as e:
                raise InvalidModelConfigException("An expected config.json file is missing from this model.") from e
        assert result is not None
        return result

    # TO DO: Add exception handling
    def _hf_definition_to_type(self, module: str, class_name: str) -> ModelMixin:  # fix with correct type
        if module in ["diffusers", "transformers"]:
            res_type = sys.modules[module]
        else:
            res_type = sys.modules["diffusers"].pipelines
        result: ModelMixin = getattr(res_type, class_name)
        return result

    def _load_diffusers_config(self, model_path: Path, config_name: str = "config.json") -> dict[str, Any]:
        return ConfigLoader.load_config(model_path, config_name=config_name)


class ConfigLoader(ConfigMixin):
    """Subclass of ConfigMixin for loading diffusers configuration files."""

    @classmethod
    def load_config(cls, *args: Any, **kwargs: Any) -> dict[str, Any]:  # pyright: ignore [reportIncompatibleMethodOverride]
        """Load a diffusrs ConfigMixin configuration."""
        cls.config_name = kwargs.pop("config_name")
        # TODO(psyche): the types on this diffusers method are not correct
        return super().load_config(*args, **kwargs)  # type: ignore
