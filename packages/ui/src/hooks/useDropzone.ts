/**
 * useDropzone — hook pour gérer le drag & drop de fichiers sur un élément.
 *
 * Usage :
 *   const { isDragging, dropzoneProps } = useDropzone({
 *     onDrop: (file) => handleScanReceipt(file),
 *     accept: ["image", "pdf"],  // optionnel : filtre par type MIME
 *     disabled: scanning,
 *   });
 *
 *   <div {...dropzoneProps} style={{ background: isDragging ? "#EFF6FF" : "#F1F5F9" }}>
 *     ...
 *   </div>
 */

import { useState, useCallback } from "react";

interface DropzoneOptions {
  onDrop: (file: File) => void;
  accept?: string[];  // Ex: ["image", "pdf", "csv"] - vérifie sur mime type
  disabled?: boolean;
}

export function useDropzone(opts: DropzoneOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (opts.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [opts.disabled, isDragging]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (opts.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, [opts.disabled]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (opts.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    // Ne réinitialise que si on quitte vraiment la zone (pas un enfant)
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, [opts.disabled]);

  const onDrop = useCallback((e: React.DragEvent) => {
    if (opts.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];

    // Vérification du type si spécifié
    if (opts.accept && opts.accept.length > 0) {
      const matches = opts.accept.some(t => file.type.includes(t) || file.name.toLowerCase().endsWith("." + t));
      if (!matches) {
        console.warn(`Fichier rejeté, type attendu : ${opts.accept.join(", ")}, reçu : ${file.type}`);
        return;
      }
    }

    opts.onDrop(file);
  }, [opts]);

  return {
    isDragging,
    dropzoneProps: {
      onDragOver,
      onDragEnter,
      onDragLeave,
      onDrop,
    },
  };
}