#!/usr/bin/env python3
"""
Script para otimizar a imagem cta-background.jpg
Reduz o tamanho do arquivo mantendo boa qualidade visual
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow nao esta instalado. Instalando...")
    os.system(f"{sys.executable} -m pip install Pillow -q")
    from PIL import Image

def format_size(size_bytes):
    """Formata tamanho em bytes para MB"""
    return size_bytes / (1024 * 1024)

def optimize_image():
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    public_dir = project_root / 'public'
    
    input_path = public_dir / 'cta-background.jpg'
    backup_path = public_dir / 'cta-background-backup.jpg'
    output_path = public_dir / 'cta-background-optimized.jpg'
    
    if not input_path.exists():
        print(f"ERRO: Arquivo nao encontrado: {input_path}")
        sys.exit(1)
    
    # Tamanho original
    original_size = input_path.stat().st_size
    print(f"Otimizando imagem: {input_path.name}")
    print(f"Tamanho original: {format_size(original_size):.2f} MB")
    
    # Abrir imagem
    with Image.open(input_path) as img:
        original_dimensions = img.size
        print(f"Dimensoes originais: {original_dimensions[0]}x{original_dimensions[1]}")
        
        # Redimensionar se necessário (max 1920px de largura)
        max_width = 1920
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            print(f"Redimensionado para: {img.size[0]}x{img.size[1]}")
        else:
            print(f"Mantendo dimensoes originais: {img.size[0]}x{img.size[1]}")
        
        # Converter para RGB se necessário (JPEG não suporta transparência)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Criar fundo branco para imagens com transparência
            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = rgb_img
        
        # Salvar otimizado (qualidade 85% - mantém excelente qualidade visual)
        img.save(
            output_path,
            'JPEG',
            quality=85,
            optimize=True,
            progressive=True
        )
    
    # Verificar tamanho otimizado
    optimized_size = output_path.stat().st_size
    reduction = ((1 - optimized_size / original_size) * 100)
    
    print(f"Otimizacao concluida!")
    print(f"Tamanho otimizado: {format_size(optimized_size):.2f} MB")
    print(f"Reducao: {reduction:.1f}%")
    
    # Fazer backup do original
    import shutil
    shutil.copy2(input_path, backup_path)
    print(f"Backup salvo em: {backup_path.name}")
    
    # Substituir o arquivo original
    shutil.copy2(output_path, input_path)
    print(f"Arquivo otimizado substituiu o original!")
    
    # Remover arquivo temporário
    output_path.unlink()
    print(f"Arquivo temporario removido")
    
    print(f"\nConcluido! Arquivo reduzido de {format_size(original_size):.2f} MB para {format_size(optimized_size):.2f} MB ({reduction:.1f}% de reducao)")

if __name__ == '__main__':
    optimize_image()