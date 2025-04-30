#!/usr/bin/env python3
"""
auto_diagram_boxes.py
─────────────────────
Locate handwritten molecular diagrams in an image using GPT-4o Vision,
iteratively refine the boxes, and output the JSON expected by the
"Handwritten-to-LaTeX" task.

Usage
~~~~~
python auto_diagram_boxes.py  \
        --image  proposal_figure_3_page0.png \
        --latex  reaction.tex                \
        --openai-key sk-********************************

Optional flags:
    --model          gpt-4o-mini   (default)  |  gpt-4o
    --tolerance-px   4             (stop if every edge moves ≤ 4 px)
    --max-iters      3             (maximum refinement rounds)
"""

# ───── imports ────────────────────────────────────────────────────────────────
import os, re, json, base64, argparse, textwrap, pathlib
from typing import List, Tuple
from PIL import Image, ImageDraw
import openai

# ───── helper ────────────────────────────────────────────────────────────────
def encode_image_b64(path: str) -> str:
    return base64.b64encode(pathlib.Path(path).read_bytes()).decode()

def openai_vision_chat(img_path: str, prompt: str, model: str) -> str:
    """Call an OpenAI Vision model and return the assistant message text."""
    b64 = encode_image_b64(img_path)
    image_dict = {"type": "image_url",
                  "image_url": {"url": f"data:image/png;base64,{b64}"}}
    resp = openai.chat.completions.create(
        model=model,
        messages=[
            {"role": "system",
             "content": ("You are an expert at detecting diagrams in "
                         "hand-written chemistry notes and returning JSON.")},
            {"role": "user", "content": [prompt, image_dict]}
        ],
    )
    return resp.choices[0].message.content

def draw_overlay(img_path: str,
                 boxes: List[Tuple[int,int,int,int]],
                 out_path: str,
                 color="red", width=4) -> None:
    img = Image.open(img_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    for (x1,y1,x2,y2) in boxes:
        draw.rectangle([x1,y1,x2,y2], outline=color, width=width)
    img.save(out_path)

def max_edge_delta(prev, new) -> int:
    """Largest single-edge difference between two bbox lists."""
    mx = 0
    for p, n in zip(prev, new):
        diffs = [abs(a-b) for a,b in zip(p, n)]
        mx = max(mx, *diffs)
    return mx

# ───── main routine ──────────────────────────────────────────────────────────
def main(args):
    openai.api_key = args.openai_key or os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        raise RuntimeError("OpenAI key not provided")

    # 1) load LaTeX & count placeholders
    latex_string = pathlib.Path(args.latex).read_text() \
                   if pathlib.Path(args.latex).exists() else args.latex
    placeholders = re.findall(r"DIAGRAM-(\d+)", latex_string)
    n_diagrams   = len(set(placeholders))
    if n_diagrams == 0:
        raise ValueError("Could not find any <<DIAGRAM_N>> placeholders")
    print(f"Found {n_diagrams} diagram placeholders in LaTeX.")

    # 2) FIRST-PASS prompt
    first_prompt = textwrap.dedent(f"""
      The image contains {n_diagrams} separate molecular diagrams that map
      exactly to the placeholders <<DIAGRAM_1>> … <<DIAGRAM_{n_diagrams}>> 
      in the LaTeX you already know.

      Return ONLY a JSON object with the key "diagrams", whose value is a list 
      of {n_diagrams} objects in exact reading order.  Each object:
        {{ "placeholder": "<<DIAGRAM_i>>",
           "bounding_box": [x_min, y_min, x_max, y_max] }}.

      • Coordinates must be integers in pixel space (origin top-left).
      • No other keys, no extra text.
    """)

    raw = openai_vision_chat(args.image, first_prompt, args.model)
    boxes_json = json.loads(re.search(r"\{.*\}", raw, re.S).group(0))
    boxes      = [tuple(d["bounding_box"]) for d in boxes_json["diagrams"]]

    # save overlay_0.png
    overlay = pathlib.Path(args.image).with_name("overlay_0.png")
    draw_overlay(args.image, boxes, overlay)
    print("Initial boxes saved to", overlay)

    # 3) iterative refinement loop
    # Hardcode the number of iterations
    max_iters = 5 
    print(f"Running exactly {max_iters} refinement iterations.")
    for i in range(1, max_iters + 1): # Use hardcoded value
        refine_prompt = textwrap.dedent(f"""
          The red rectangles are what YOU produced last time (see attached).
          JSON you produced:
          ```json
          {json.dumps(boxes_json, indent=2)}
          ```
          Please adjust any rectangle that is off by more than {args.tolerance_px} px.
          If everything is already correct within that tolerance, return the
          IDENTICAL JSON. Output ONLY the JSON.
        """)
        raw = openai_vision_chat(str(overlay), refine_prompt, args.model)
        new_json = json.loads(re.search(r"\{.*\}", raw, re.S).group(0))
        new_boxes = [tuple(d["bounding_box"]) for d in new_json["diagrams"]]

        delta = max_edge_delta(boxes, new_boxes)
        print(f"iter {i}: max edge change = {delta}px")

        boxes_json = new_json
        boxes      = new_boxes
        overlay = overlay.with_name(f"overlay_{i}.png")
        draw_overlay(args.image, boxes, overlay)

        # Removed the convergence check and break statement
        # if delta <= args.tolerance_px:
        #     print("Converged!")
        #     break
    # else: # This 'else' clause belongs to the 'for' loop, indicating completion without break
    print(f"Completed {max_iters} refinement iterations.") # Updated message

    # 4) final package
    final = {
        "latex_content": latex_string,
        "diagrams": boxes_json["diagrams"]
    }
    out_file = pathlib.Path(args.out_json)
    out_file.write_text(json.dumps(final, indent=2))
    print("Final JSON saved to", out_file)

# ───── argparse wrapper ───────────────────────────────────────────────────────
if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Iterative GPT-4o Vision diagram boxing")
    p.add_argument("--image", required=True, help="Path to handwritten image")
    p.add_argument("--latex", required=True,
                   help="Path to LaTeX file OR literal LaTeX string")
    p.add_argument("--openai-key", help="Your OpenAI API key (or set env var)")
    p.add_argument("--model", default="gpt-4o-mini")
    p.add_argument("--tolerance-px", type=int, default=4)
    # Default max-iters is still 3, but we override it in main()
    p.add_argument("--max-iters", type=int, default=3) 
    p.add_argument("--out-json",    default="final_diagrams.json")
    args = p.parse_args()
    main(args)
