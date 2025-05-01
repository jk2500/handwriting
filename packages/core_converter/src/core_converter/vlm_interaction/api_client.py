"""
Handles interaction with the external Vision Language Model (VLM) API.
Currently configured for OpenAI API (GPT-4V or similar).
"""

import os
import base64
from dotenv import load_dotenv
from openai import OpenAI # Import the OpenAI library
import re # Import regex module
# import requests # No longer needed for basic OpenAI calls

# Load environment variables from .env file
load_dotenv()

DUMMY_LATEX_OUTPUT = r"""
\documentclass{article}
\usepackage{amsmath}
\author{ramakrishna} % Added default author
\begin{document}

This is a placeholder LaTeX document generated because the VLM API interaction is not yet fully implemented or failed.

Here is a sample equation: 
$E = mc^2$

\end{document}
"""

def get_latex_from_image(image_path: str, model_name: str = "gpt-4-vision-preview") -> str:
    """
    Sends an image to the specified OpenAI API vision model
    and returns the recognized LaTeX content.

    Placeholder implementation: Checks for OPENAI_API_KEY env variable.
    If not found, placeholder key is used, or any error occurs,
    returns a dummy LaTeX string.

    Args:
        image_path: Path to the input image file (PNG format recommended).
        model_name: The specific OpenAI model to use (e.g., 'gpt-4-vision-preview').

    Returns:
        Tuple containing: (LaTeX string, Descriptions string)
    """
    try:
        # --- API Interaction ---
        print(f"Attempting OpenAI API interaction with model: {model_name}...")

        # 1. Configuration Check
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "YOUR_OPENAI_KEY_HERE":
            raise ValueError("Placeholder API key found or OPENAI_API_KEY not set in .env.")

        client = OpenAI()

        # 2. Encode Image
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')

        # 3. Make API Call
        response = client.chat.completions.create(
    model=model_name,
    messages=[
        # 1️⃣  Hard contract
        {
            "role": "system",
            "content": (
                "You are a LaTeX transcription assistant specializing in chemistry and physics.\n"
                "Your output MUST contain two parts:\n"
                "1. A *complete* LaTeX document, starting with `\documentclass{article}` and ending with `\end{document}`, wrapped in a single ```latex ... ``` code block. This block MUST contain placeholders (`STRUCTURE-N`, `DIAGRAM-M`) as specified below.\n"
                "2. After the closing ``` of the LaTeX block, a list of descriptions for EACH placeholder used. Use the exact format:\n"
                "Placeholder: [Placeholder Name (e.g., STRUCTURE-1)]\nDescription: [Concise textual description]\n"
                "(Repeat for each placeholder, ensuring each description starts on a new line immediately after 'Description: ')\n\n"
                "LaTeX Content Rules:\n"
                "1. Include packages: `amsmath`, `graphicx`, `amssymb`, `mhchem`, `chemfig`.\n"
                "2. Include the author command: `\author{ramakrishna}` after the `\usepackage` commands.\n"
                "3. Transcribe standard text, equations (use math environments), and symbols accurately.\n"
                "4. **Chemical Structures/Reactions:** For handwritten molecular drawings or reaction schemes that are part of an equation or text flow:\n"
                "   - Replace the structure/scheme with a LaTeX comment placeholder: `% PLACEHOLDER: STRUCTURE-N` (start N at 1).\n"
                "   - Insert this comment placeholder *inline* within the math environment or text where the structure was.\n"
                "   - Do NOT use `chemfig`, `\ce{}`, or the raw label (STRUCTURE-N) directly; use the comment placeholder.\n"
                "5. **General Diagrams:** For graphs, plots, illustrations, flowcharts, etc. NOT inline:\n"
                "   - On a line *by itself*, write exactly `% PLACEHOLDER: DIAGRAM-M` (start M at 1).\n"
                "   - Do NOT insert the raw label (DIAGRAM-M) directly.\n"
                "6. Numbering: Use separate counters for STRUCTURE-N and DIAGRAM-M (within the placeholders and descriptions).\n"
                "7. Do NOT generate TikZ or PGFPlots.\n"
                "If you violate the output format or rules, the answer will be discarded."
            )
        },

        # 2️⃣  (Optional but helps) one-shot example
        {
            "role": "assistant",
            "content": (
                "```latex\n"
                "\documentclass{article}\n"
                "\usepackage{amsmath}\n"
                "\usepackage{graphicx}\n"
                "\usepackage{amssymb}\n"
                "\usepackage{mhchem}\n"
                "\usepackage{chemfig}\n"
                "\author{ramakrishna}\n"
                "\n"
                "\begin{document}\n"
                "\n"
                "The reaction is:\n"
                "\[\n"
                "\ce{ReactantA} + % PLACEHOLDER: STRUCTURE-1 \longrightarrow % PLACEHOLDER: STRUCTURE-2 + \ce{SideProductB}\n"
                "\]\n"
                "\n"
                "% PLACEHOLDER: DIAGRAM-1\n"
                "\n"
                "Final energy is $E = mc^2$.\n"
                "\n"
                "\end{document}\n"
                "```\n"
                "Placeholder: STRUCTURE-1\nDescription: Benzene ring with a methyl group.\n"
                "Placeholder: STRUCTURE-2\nDescription: Cyclohexane molecule.\n"
                "Placeholder: DIAGRAM-1\nDescription: Plot of Temperature vs Time showing an initial increase followed by a plateau.\n"
            )
        },

        # 3️⃣  Your actual request
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "Convert the handwritten content. First, provide the complete LaTeX document in a ```latex block, using `% PLACEHOLDER: STRUCTURE-N` comment placeholders inline for chemical structures/reactions and `% PLACEHOLDER: DIAGRAM-M` comment placeholders on their own lines for standalone diagrams. Include \author{ramakrishna}. "
                        "Second, after the ```latex block, list descriptions for every placeholder used, following the 'Placeholder: ...\nDescription: ...' format exactly. Adhere strictly to all system rules."
                    )
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{base64_image}"}
                }
            ]
        }
    ],
)

        # 5. Process Response & Extract LaTeX
        raw_content = response.choices[0].message.content
        print(f"OpenAI API call successful for model {model_name}.")

        latex_content = ""
        descriptions_text = "" 

        match_latex = re.search(r"```(latex)?\s*(.*?)\s*```", raw_content, re.DOTALL | re.IGNORECASE)
        if match_latex:
            latex_content = match_latex.group(2).strip()
            print("Extracted LaTeX content using ``` block.")
            description_start_index = match_latex.end() 
            descriptions_text = raw_content[description_start_index:].strip()
            print(f"Extracted potential descriptions part: '{descriptions_text[:100]}...'" ) 
        else:
            print("Warning: Could not find the expected ```latex ... ``` block. Cannot process.")
            raise ValueError("Failed to parse VLM response: LaTeX block not found.")

        if latex_content and not latex_content.startswith("\documentclass"):
            print("Warning: Extracted LaTeX content doesn't start with \documentclass. May be incomplete.")
        
        # Ensure author is present if somehow missed by the model
        if latex_content and "\author" not in latex_content:
            print("Warning: \author command missing from generated LaTeX. Adding default.")
            # Attempt to insert after usepackage block or after documentclass
            lines = latex_content.split('\n')
            insert_pos = -1
            for i, line in enumerate(lines):
                if line.strip().startswith("\usepackage"):
                    insert_pos = i + 1 # Mark position after the last usepackage
                elif line.strip().startswith("\documentclass") and insert_pos == -1:
                     insert_pos = i + 1 # Fallback to after documentclass
            if insert_pos != -1:
                lines.insert(insert_pos, "\author{ramakrishna}")
                latex_content = "\n".join(lines)
            else:
                 # Failsafe: Prepend if no suitable insertion point found
                 latex_content = "\author{ramakrishna}\n" + latex_content


        return latex_content, descriptions_text

    except FileNotFoundError:
        print(f"Error: Image file not found at '{image_path}'")
        print("Returning dummy LaTeX output and no descriptions.")
        return DUMMY_LATEX_OUTPUT, ""
    except ValueError as ve:
        print(f"Error processing VLM response: {ve}")
        print("Returning dummy LaTeX output and no descriptions.")
        return DUMMY_LATEX_OUTPUT, ""
    except Exception as e:
        print(f"An error occurred during OpenAI API interaction or processing: {e}")
        print("Returning dummy LaTeX output and no descriptions.")
        return DUMMY_LATEX_OUTPUT, "" 