import Image from 'next/image';

export function OfferShot({
  src,
  alt,
  width,
  height,
  sizes,
  className = '',
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={`h-auto w-full ${className}`}
    />
  );
}
