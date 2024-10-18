from typing import Optional

from pydantic import BaseModel, Field

from invokeai.app.services.image_records.image_records_common import ImageCategory, ImageRecord, ResourceOrigin
from invokeai.app.util.model_exclude_null import BaseModelExcludeNull

from PIL.Image import Image as PILImageType


class ImageUrlsDTO(BaseModelExcludeNull):
    """The URLs for an image and its thumbnail."""

    image_name: str = Field(description="The unique name of the image.")
    """The unique name of the image."""
    image_url: str = Field(description="The URL of the image.")
    """The URL of the image."""
    thumbnail_url: str = Field(description="The URL of the image's thumbnail.")
    """The URL of the image's thumbnail."""


class ImageDTO(ImageRecord, ImageUrlsDTO):
    """Deserialized image record, enriched for the frontend."""

    board_id: Optional[str] = Field(
        default=None, description="The id of the board the image belongs to, if one exists."
    )
    """The id of the board the image belongs to, if one exists."""


def image_record_to_dto(
    image_record: ImageRecord,
    image_url: str,
    thumbnail_url: str,
    board_id: Optional[str],
) -> ImageDTO:
    """Converts an image record to an image DTO."""
    return ImageDTO(
        **image_record.model_dump(),
        image_url=image_url,
        thumbnail_url=thumbnail_url,
        board_id=board_id,
    )

class ImageBulkUploadData(BaseModel):
    image: PILImageType
    image_name: Optional[str] = None
    image_url: Optional[str] = None
    board_id: Optional[str] = None
    metadata: Optional[str] = None
    workflow: Optional[str] = None
    graph: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

    class Config:
        arbitrary_types_allowed = True
