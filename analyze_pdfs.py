from pypdf import PdfReader
import sys
import os

def extract_images(pdf_path, output_prefix):
    try:
        reader = PdfReader(pdf_path)
        images = []
        for i, page in enumerate(reader.pages):
            for j, image_obj in enumerate(page.images):
                filename = f"{output_prefix}_p{i}_img{j}.{image_obj.name.split('.')[-1] if '.' in image_obj.name else 'png'}"
                with open(filename, "wb") as f:
                    f.write(image_obj.data)
                images.append(filename)
        return images
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    files = [
        (r"d:\Daniel\Paginas\Clientes\Avicola del Sur\CamScanner 18-02-2026 19.46.pdf", "img1"),
        (r"d:\Daniel\Paginas\Clientes\Avicola del Sur\CamScanner 18-02-2026 19.52.pdf", "img2")
    ]
    for f, prefix in files:
        print(f"Extracting images from {f}:")
        print(extract_images(f, prefix))
        print("="*50)
