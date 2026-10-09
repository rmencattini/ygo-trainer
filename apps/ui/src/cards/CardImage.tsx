import { useEffect, useState } from "react";

export interface ImageSource {
  get(code: number): Promise<Uint8Array | null>;
}

export function CardImage({
  code,
  name,
  images,
  className = "card-image",
}: {
  code: number;
  name: string;
  images: ImageSource;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let live = true;
    images.get(code).then((bytes) => {
      if (!live || !bytes) return;
      objectUrl = URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: "image/jpeg" }),
      );
      setUrl(objectUrl);
    });
    return () => {
      live = false;
      setUrl(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [code, images]);

  if (!url)
    return (
      <div className={`${className} ${className}--empty`} aria-hidden="true" />
    );
  return <img className={className} src={url} alt={name} />;
}
