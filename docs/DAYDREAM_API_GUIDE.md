# Stream Diffusion Integration Guide

## Create a Stream

Use the Stream Diffusion pipeline (pip_qpUgXycjWF6YMeSL) to create a new stream. This returns a `stream_key` to push RTMP video and a `playback_id` to view the stream via HLS.

### Shell Script

```bash
#!/bin/bash

# Required: set your API key in environment
if [[ -z "$DAYDREAM_API_KEY" ]]; then
  echo "Error: DAYDREAM_API_KEY is not set"
  exit 1
fi

# 'staging' or 'production'
MODE="staging"

# API settings
if [[ "$MODE" == "production" ]]; then
  BASE_URL="https://api.daydream.live/v1"
  PIPELINE_ID="pip_qpUgXycjWF6YMeSL"
  INGEST_DOMAIN="ai.livepeer.com"
  CDN_DOMAIN="livepeercdn.com"
else
  BASE_URL="https://pipelines-api-staging.fly.dev/v1"
  PIPELINE_ID="pip_c46vpVLYifn2Lofp"
  INGEST_DOMAIN="ai.livepeer.monster"
  CDN_DOMAIN="livepeercdn.monster"
fi

PROMPT="Spider-Man swinging through a futuristic neon-lit city"

# Create stream
HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/streams" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DAYDREAM_API_KEY}" \
  -d "{\"pipeline_id\":\"${PIPELINE_ID}\",\"pipeline_params\":{\"prompt\":\"${PROMPT}\"}}")

# Parse response
STREAM_RESPONSE=$(echo "$HTTP_RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n1)

echo "HTTP Status Code: $HTTP_STATUS"
if [[ "$HTTP_STATUS" != "201" ]]; then
  echo "Error: Stream creation failed."
  echo "$STREAM_RESPONSE"
  exit 1
fi

# Extract fields
STREAM_ID=$(echo "$STREAM_RESPONSE" | jq -r '.id')
STREAM_KEY=$(echo "$STREAM_RESPONSE" | jq -r '.stream_key')
OUTPUT_PLAYBACK_ID=$(echo "$STREAM_RESPONSE" | jq -r '.output_playback_id')

# Construct URLs
INGEST_URL="rtmp://${INGEST_DOMAIN}:1935/aiWebrtc/${STREAM_KEY}"
PLAYBACK_URL="https://${CDN_DOMAIN}/hls/${OUTPUT_PLAYBACK_ID}/index.m3u8"

# Output results
echo "Stream ID:        $STREAM_ID"
echo "Stream Key:       $STREAM_KEY"
echo "RTMP Ingest URL:  $INGEST_URL"
echo "HLS Playback URL: $PLAYBACK_URL"

```

---

## Get Stream Status

The stream status API can be used to get access to things like errors and stats like output FPS.

```bash
curl https://pipelines.livepeer.monster/api/streams/${STREAM_ID}/status
# production
curl https://daydream.live/api/streams/${STREAM_ID}/status
```

### Example Response

```json
{
    "success": true,
    "error": null,
    "data": {
        "gateway_status": {
            "ingest_metrics": {
                "stats": {
                    "peer_conn_stats": {
                        "ID": "iceTransport",
                        "BytesReceived": 450224123,
                        "BytesSent": 2524525
                    },
                    "track_stats": [
                        {
                            "type": "video",
                            "jitter": 12.49713636891268,
                            "packets_lost": 1,
                            "packets_received": 397836,
                            "packet_loss_pct": 0.00025135922500923747,
                            "rtt": 0
                        },
                        {
                            "type": "audio",
                            "jitter": 19.96005315215903,
                            "packets_lost": 5,
                            "packets_received": 182269,
                            "packet_loss_pct": 0.002743122990662409,
                            "rtt": 0
                        }
                    ],
                    "conn_quality": "good"
                }
            },
            "whep_url": "https://fra-ai-mediamtx-0.livepeer.com/aiWebrtc/stk_BSYNaSWCQ1GLF1BB-9f5fabea-out/whep"
        },
        "inference_status": {
            "fps": 22.785628275965674,
            "last_error": null,
            "last_error_time": null,
            "last_output_time": 1752771639149,
            "last_params": {
                "height": 512,
                "prompt": {
                },
                "width": 512
            },
            "last_params_hash": "5fc59094b46754c6fcdeef7e2a5fe87e",
            "last_params_update_time": 1752767999193,
            "last_restart_logs": null,
            "last_restart_time": null,
            "restart_count": 0
        },
        "input_status": {
            "fps": 22.98550220821099,
            "last_input_time": 1752771639164
        },
        "last_state_update_time": 1752771285379,
        "orchestrator_info": {
            "address": "0x180859c337d14edf588c685f3f7ab4472ab6a252",
            "url": "https://mar-0.lvpr.io:20408"
        },
        "pipeline": "comfyui",
        "pipeline_id": "pip_QugCMu6SNik5hRFu",
        "request_id": "9f5fabea",
        "start_time": 1752767999192,
        "state": "ONLINE",
        "stream_id": "str_wuhLfV3QUbvwNFgi",
        "timestamp": 1752771639196,
        "type": "status"
    }
}
```

## Playback

For the quickest playback startup, use the WHEP URL from the [stream status](https://www.notion.so/Guide-Daydream-APIs-22d0a348568780bca7b7c1dd7a37c63f?pvs=21) endpoint.

Call the stream status endpoint e.g. [`curl https://pipelines.livepeer.monster/api/streams/STREAM_ID/status`](https://pipelines.livepeer.monster/api/streams/str_F9S23MsUiyn8J2EQ/status). A few seconds after stream start the WHEP URL will be available in the response at `data -> gateway_status -> whep_url`:

```json
{
  "success": true,
  "error": null,
  "data": {
	  "gateway_status": {
	    "ingest_metrics": {
	      ...
	    },
	    "whep_url": "https://prg-staging-ai-mediamtx-0.livepeer.monster/aiWebrtc/stk_HiWePo55sUAB5hbe-9cabf64d-out/whep"
	  }
  }
}
```

## Update Stream Params

This endpoint allows you to update generation parameters mid-stream.

### Example Request

```bash
# Use the stream id from the previous reponse
curl -X POST \
  "https://pipelines-api-staging.fly.dev/beta/streams/${STREAM_ID}/prompts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DAYDREAM_API_KEY}" \
  -d '{
    "pipeline": "live-video-to-video",
    "model_id": "streamdiffusion",
    "params": {
      "model_id": "stabilityai/sd-turbo",
      "prompt": "Spider-Man swinging through a futuristic neon-lit city",
      "negative_prompt": "blurry, low quality, cartoon, watermark, text",
      "seed": 123
    }
  }'

  # PRODUCTION
curl -X POST \
  "https://api.daydream.live/beta/streams/${STREAM_ID}/prompts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DAYDREAM_API_KEY}" \
  -d '{
    "pipeline": "live-video-to-video",
    "model_id": "streamdiffusion",
    "params": {
      "model_id": "stabilityai/sd-turbo",
      "prompt": "Spider-Man swinging through a futuristic neon-lit city",
      "negative_prompt": "blurry, low quality, cartoon, watermark, text",
      "seed": 123
    }
  }'

```

Ensure both `DAYDREAM_API_KEY` and `STREAM_ID` are exported in your environment.

Notice that `prompt` and `seed` can also be a list of `[[<prompt1>, <weight1>], [prompt2, weight2], ...]` for prompt blending.

---

## Simplified Params Schema

If using Python, you can copy the pydantic types defined [here](https://github.com/livepeer/ai-runner/blob/0e1e9093310acc84d09ae35b562a05d25e69b9ba/runner/app/live/pipelines/streamdiffusion.py#L17-L130).

### `ControlNetConfig`

```tsx
{
  model_id: string;
  conditioning_scale?: number;
  preprocessor?: string;
  preprocessor_params?: Record<string, any>;
  enabled?: boolean;
  control_guidance_start?: number;
  control_guidance_end?: number;
}
```

### `StreamDiffusionParams`

```tsx
{
  model_id?: string;
  prompt?: string | Array<[string, number]>;
  prompt_interpolation_method?: "linear" | "slerp";
  negative_prompt?: string;
  guidance_scale?: number;
  delta?: number;
  num_inference_steps?: number;
  t_index_list?: number[];
  width?: number;
  height?: number;
  lora_dict?: Record<string, any> | null;
  use_lcm_lora?: boolean;
  lcm_lora_id?: string;
  acceleration?: string;
  use_denoising_batch?: boolean;
  do_add_noise?: boolean;
  seed?: number | Array<[number, number]>;
  seed_interpolation_method?: "linear" | "slerp";
  enable_similar_image_filter?: boolean;
  similar_image_filter_threshold?: number;
  similar_image_filter_max_skip_frame?: number;
  controlnets?: ControlNetConfig[];
}
```

### `SubmitStreamDiffusionRequest`

```tsx
{
  pipeline: string;
  model_id: string;
  params: StreamDiffusionParams;
}
```

### `SubmitStreamDiffusionResponse`

```tsx
{
  success: boolean;
  message: string;
  was_censored?: boolean;
}
```

## Complete Params Schema

### Default Values

No need to specify any values that are already the default (e.g. `model_id`, sd-turbo being the only current one with controlnet support).

The supported ControlNet models are all the ones specified on the default values as well.

```json
{
  "model_id": "stabilityai/sd-turbo",
  "prompt": "an anime render of a girl with purple hair, masterpiece",
  "prompt_interpolation_method": "slerp",
  "normalize_seed_weights": true,
  "normalize_prompt_weights": true,
  "negative_prompt": "blurry, low quality, flat, 2d",
  "guidance_scale": 1.0,
  "delta": 0.7,
  "num_inference_steps": 50,
  "t_index_list": [12, 20, 32],
  "width": 704,
  "height": 384,
  "lora_dict": null,
  "use_lcm_lora": true,
  "lcm_lora_id": "latent-consistency/lcm-lora-sdv1-5",
  "acceleration": "tensorrt",
  "use_denoising_batch": true,
  "do_add_noise": true,
  "seed": 789,
  "seed_interpolation_method": "linear",
  "enable_similar_image_filter": false,
  "similar_image_filter_threshold": 0.98,
  "similar_image_filter_max_skip_frame": 10,
  "controlnets": [
    {
      "model_id": "thibaud/controlnet-sd21-openpose-diffusers",
      "conditioning_scale": 0.711,
      "preprocessor": "pose_tensorrt",
      "preprocessor_params": {},
      "enabled": true,
      "control_guidance_start": 0.0,
      "control_guidance_end": 1.0
    },
    {
      "model_id": "thibaud/controlnet-sd21-hed-diffusers",
      "conditioning_scale": 0.2,
      "preprocessor": "soft_edge",
      "preprocessor_params": {},
      "enabled": true,
      "control_guidance_start": 0.0,
      "control_guidance_end": 1.0
    },
    {
      "model_id": "thibaud/controlnet-sd21-canny-diffusers",
      "conditioning_scale": 0.2,
      "preprocessor": "canny",
      "preprocessor_params": {
        "low_threshold": 100,
        "high_threshold": 200
      },
      "enabled": true,
      "control_guidance_start": 0.0,
      "control_guidance_end": 1.0
    },
    {
      "model_id": "thibaud/controlnet-sd21-depth-diffusers",
      "conditioning_scale": 0.5,
      "preprocessor": "depth_tensorrt",
      "preprocessor_params": {},
      "enabled": true,
      "control_guidance_start": 0.0,
      "control_guidance_end": 1.0
    },
    {
      "model_id": "thibaud/controlnet-sd21-color-diffusers",
      "conditioning_scale": 0.2,
      "preprocessor": "passthrough",
      "preprocessor_params": {},
      "enabled": true,
      "control_guidance_start": 0.0,
      "control_guidance_end": 1.0
    }
  ]
}
```

### JSON Schema

```yaml
title: StreamDiffusionParams
type: object
additionalProperties: false
properties:
  acceleration:
    title: Acceleration
    type: string
    default: tensorrt
    enum:
    - 2
    - xformers
    - tensorrt
  controlnets:
    title: Controlnets
    default:
    - conditioning_scale: 0.711
      control_guidance_end: 1.0
      control_guidance_start: 0.0
      enabled: true
      model_id: thibaud/controlnet-sd21-openpose-diffusers
      preprocessor: pose_tensorrt
      preprocessor_params: {}
    - conditioning_scale: 0.2
      control_guidance_end: 1.0
      control_guidance_start: 0.0
      enabled: true
      model_id: thibaud/controlnet-sd21-hed-diffusers
      preprocessor: soft_edge
      preprocessor_params: {}
    - conditioning_scale: 0.2
      control_guidance_end: 1.0
      control_guidance_start: 0.0
      enabled: true
      model_id: thibaud/controlnet-sd21-canny-diffusers
      preprocessor: canny
      preprocessor_params:
        high_threshold: 200
        low_threshold: 100
    - conditioning_scale: 0.5
      control_guidance_end: 1.0
      control_guidance_start: 0.0
      enabled: true
      model_id: thibaud/controlnet-sd21-depth-diffusers
      preprocessor: depth_tensorrt
      preprocessor_params: {}
    - conditioning_scale: 0.2
      control_guidance_end: 1.0
      control_guidance_start: 0.0
      enabled: true
      model_id: thibaud/controlnet-sd21-color-diffusers
      preprocessor: passthrough
      preprocessor_params: {}
    anyOf:
    - type: array
      items:
        title: ControlNetConfig
        type: object
        description: ControlNet configuration model
        properties:
          conditioning_scale:
            title: Conditioning Scale
            type: number
            default: 1.0
          control_guidance_end:
            title: Control Guidance End
            type: number
            default: 1.0
          control_guidance_start:
            title: Control Guidance Start
            type: number
            default: 0.0
          enabled:
            title: Enabled
            type: boolean
            default: true
          model_id:
            title: Model Id
            type: string
          preprocessor:
            title: Preprocessor
            default: null
            anyOf:
            - type: string
            - type: 'null'
          preprocessor_params:
            title: Preprocessor Params
            default: null
            anyOf:
            - type: object
            - type: 'null'
        required:
        - model_id
    - type: 'null'
  delta:
    title: Delta
    type: number
    default: 0.7
  do_add_noise:
    title: Do Add Noise
    type: boolean
    default: true
  enable_similar_image_filter:
    title: Enable Similar Image Filter
    type: boolean
    default: false
  guidance_scale:
    title: Guidance Scale
    type: number
    default: 1.0
  height:
    title: Height
    type: integer
    default: 384
  lcm_lora_id:
    title: Lcm Lora Id
    type: string
    default: latent-consistency/lcm-lora-sdv1-5
  lora_dict:
    title: Lora Dict
    default: null
    anyOf:
    - type: object
      additionalProperties:
        type: number
    - type: 'null'
  model_id:
    title: Model Id
    type: string
    default: stabilityai/sd-turbo
  negative_prompt:
    title: Negative Prompt
    type: string
    default: blurry, low quality, flat, 2d
  normalize_seed_weights:
    title: Normalize seed Weights
    type: boolean
    default: true
  normalize_prompt_weights:
    title: Normalize prompt Weights
    type: boolean
    default: true
  num_inference_steps:
    title: Num Inference Steps
    type: integer
    default: 50
  prompt:
    title: Prompt
    default: an anime render of a girl with purple hair, masterpiece
    anyOf:
    - type: string
    - type: array
      items:
        type: array
        maxItems: 2
        minItems: 2
        prefixItems:
        - type: string
        - type: number
  prompt_interpolation_method:
    title: Prompt Interpolation Method
    type: string
    default: slerp
    enum:
    - linear
    - slerp
  seed:
    title: Seed
    default: 789
    anyOf:
    - type: integer
    - type: array
      items:
        type: array
        maxItems: 2
        minItems: 2
        prefixItems:
        - type: integer
        - type: number
  seed_interpolation_method:
    title: Seed Interpolation Method
    type: string
    default: linear
    enum:
    - linear
    - slerp
  similar_image_filter_max_skip_frame:
    title: Similar Image Filter Max Skip Frame
    type: integer
    default: 10
  similar_image_filter_threshold:
    title: Similar Image Filter Threshold
    type: number
    default: 0.98
  t_index_list:
    title: T Index List
    type: array
    default:
    - 12
    - 20
    - 32
    items:
      type: integer
  use_denoising_batch:
    title: Use Denoising Batch
    type: boolean
    default: true
  use_lcm_lora:
    title: Use Lcm Lora
    type: boolean
    default: true
  width:
    title: Width
    type: integer
    default: 704
```
