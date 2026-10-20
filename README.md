# 4A Bounding Boxes

A port of ComfyUI's built-in **Create Bounding Boxes** node that works in the
classic (LiteGraph) node renderer.

The official node is currently beta and its editor is a Vue widget, so it only
works with **Node 2.0** enabled. This plugin keeps the same backend logic and
re-implements the editor as a classic DOM widget, so you can use it without
switching to Node 2.0.

## Features

Same behaviour and outputs as the official node:

- Draw, move and resize boxes on a canvas (with optional grid snapping)
- Object / text box types, with text, description and color palette per box
- Optional background image and incoming `bboxes` input
- Outputs: `preview` (IMAGE), `bboxes` (BOUNDING_BOX), `elements` (ARRAY)

The `elements` output can be connected directly to **MOSS-Image Layout Prompt**.

## Installation

Clone or copy this folder into `ComfyUI/custom_nodes/`, then restart ComfyUI.

The node appears as **Create Bounding Boxes** under the `4A-BoundingBoxes`
category.

## Credits & License

Node logic and editor behaviour are adapted from
[ComfyUI](https://github.com/Comfy-Org/ComfyUI) and
[ComfyUI_frontend](https://github.com/Comfy-Org/ComfyUI_frontend), both licensed
under GPL-3.0. This project is therefore also released under the
[GNU General Public License v3.0](LICENSE).
