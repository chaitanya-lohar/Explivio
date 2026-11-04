# M7 — Zero-cost illustration options

**Question:** can Explivio get illustrations that make scenes clearer than its programmatic templates, at **$0**?

**Short answer:** not reliably on this machine with generative models. Keep improving programmatic SVG/Remotion visuals, which is what M7 did. A small local image-model trial is possible at $0, but it needs your go-ahead (software install plus a 2–4 GB download). It's not recommended for diagrams, because those models can't draw accurate scientific relationships or text.

Nothing in this report was downloaded, installed or integrated. Everything below was checked on 2026-11-02 without any paid service.

## 1. This machine (checked 2026-11-02)

| Resource | Value | Effect on local image generation |
|---|---|---|
| CPU | AMD Ryzen 5 5625U, 6 cores / 12 threads | CPU-only diffusion works but is slow |
| GPU | Integrated AMD Radeon; 512 MB reserved, the rest shared with system RAM; no CUDA | Most tools assume NVIDIA CUDA. AMD on Windows needs DirectML (ONNX Runtime) or Vulkan (stable-diffusion.cpp) |
| RAM | 15.3 GB total, about 4.1 GB free while working | SD 1.5-class fits; SDXL-class (about 7 GB of weights) would swap; FLUX-class (about 24 GB) can't run |
| Disk | D: 157 GB free; C: 24.7 GB free | Fine on D:. Model caches must be pointed at D: (C: is tight) |
| Python | Not installed (only the Windows Store placeholder is present) | Python-based tools need a new install first |

## 2. Options compared

Generation-speed figures for local models are **estimates for this class of hardware**, not measurements. Nothing was run.

| Option | Cost | Image quality | Educational accuracy | Hardware fit | Est. speed (512×512) | Storage | Licence | Operational complexity |
|---|---|---|---|---|---|---|---|---|
| **Programmatic SVG + Remotion** (the M7 templates, plus drawn bodies such as Earth, Moon and Sun) | $0 | Clean, consistent and sharp at any size | **High, by construction**: geometry and labels come from validated data (for example, the new moon is placed between Earth and the Sun) | Already runs | Instant (rendered with the video) | None | Our own code | Low; already in the pipeline |
| **Stable Diffusion 1.5-class** (ONNX Runtime + DirectML on the integrated GPU, or stable-diffusion.cpp with Vulkan) | $0 | Fair at 512×512; soft details; style drifts between images | **Low** for diagrams: wrong counts, impossible geometry, unreadable text | Fits (about 2 GB fp16 weights) | Roughly 1–3 min per image on CPU at 20 steps; perhaps 20–60 s with GPU acceleration | 2–4 GB plus the runtime | CreativeML OpenRAIL-M: use restrictions, commercial use allowed under its conditions. **Re-check at download time.** | Medium: new runtime, model download, prompt tuning, manual review of every image |
| **Few-step distilled models** (SD-Turbo-class, 1–4 steps) | $0 | Fair, 512×512 | Low (same weaknesses) | Fits | Perhaps 10–40 s per image on CPU | About 2–3.5 GB | Varies by release; some are non-commercial or community-licence only. **Must be verified per model before any download.** | Medium |
| **SDXL / FLUX-class** | $0 | Good | Still unreliable for diagrams | **Does not fit** (RAM/VRAM) | Impractical | 7–24 GB | Various | High |
| **Free-licence image libraries** (NASA imagery, generally public domain except insignia; Wikimedia Commons with per-file licences; CC0 collections) | $0 | High (real photos) | High for *what something looks like*; doesn't explain processes | No compute | n/a | Small, stored locally | **Per file**: record the source, licence and attribution; no hotlinking | Low–medium: curation and attribution per asset; only covers common topics |
| Paid or billing-gated image APIs (including Gemini image models) | Paid or unverifiable | — | — | — | — | — | — | **Skipped** under the $0 policy |

## 3. Assessment

1. **Accuracy is what matters for Explivio.** M7's errors to avoid (the Sun at the centre of a Moon orbit, an invented date, a cycle that isn't one) are exactly the kind a diffusion model makes freely. The templates make them impossible or catch them (step 4 lint).
2. **Text in images:** diffusion models can't reliably render labels, and our explanations depend on labels appearing as they're spoken.
3. **Consistency:** a video needs 3–8 scenes in one style. Local models drift between images unless you add more tooling (LoRAs, seeds, img2img), which is more complexity on weak hardware.
4. **Where pictures would help:** mood and recognition shots, such as a real photo of the Moon or a leaf. Free-licence photos do this better than generated images, and the editorial renderer already supports a background image (used by the demo themes).

## 4. Recommendation

- **Now:** keep the programmatic approach. M7 added orbit (with drawn celestial bodies and lighting), layers, timeline, flow, cycle and comparison, all accurate by construction.
- **Next, at $0 and no new dependencies:** a small library of hand-built SVG illustrations for frequent subjects (leaf, cell, heart, server/phone, cloud), used inside templates.
- **Optional, only with your go-ahead:** a time-boxed local trial of one SD 1.5-class model on D: (about 3 GB). It would run through stable-diffusion.cpp (one binary, Vulkan, no Python) or ONNX Runtime + DirectML (needs Python).
  - **Scope:** at most 9 images for 3 topics, each compared with the template version of the same scene for relevance, accuracy, artefacts, consistency and time per image.
  - **Before downloading:** the model's licence will be checked again.
  - **Afterwards:** nothing goes into the pipeline unless you approve it after seeing the comparison.
- **Free-licence photos:** if wanted, start with NASA imagery for astronomy topics, with source and licence recorded per file.

**Decision needed from you:** run the optional local trial (yes/no). Until then this workstream is **paused** at the report stage.
