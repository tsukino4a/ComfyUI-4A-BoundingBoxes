"""
@author: 4A
@title: ComfyUI-4A-BoundingBoxes
@nickname: 4A Bounding Boxes
@description: Create Bounding Boxes editor that works in the classic (LiteGraph) node renderer.
"""

from .nodes.bounding_boxes import CreateBoundingBoxes4A

NODE_CLASS_MAPPINGS = {
    CreateBoundingBoxes4A.NAME: CreateBoundingBoxes4A,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    CreateBoundingBoxes4A.NAME: "Create Bounding Boxes",
}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
