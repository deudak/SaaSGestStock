import { FaBox } from "react-icons/fa";

const tints = ["bg-brand-50 text-brand-500", "bg-emerald-50 text-emerald-500", "bg-amber-50 text-amber-500", "bg-violet-50 text-violet-500", "bg-sky-50 text-sky-500"];

export default function ProductThumb({ product, size = "md", className = "" }) {
  const sizes = { sm: "h-9 w-9 rounded-lg", md: "h-11 w-11 rounded-xl", lg: "h-full w-full rounded-xl" };
  if (product?.image) {
    return <img src={product.image} alt="" className={`shrink-0 object-cover ${sizes[size]} ${className}`} loading="lazy" />;
  }
  const hash = [...(product?.category || "")].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return (
    <div className={`flex shrink-0 items-center justify-center ${tints[hash % tints.length]} ${sizes[size]} ${className}`} aria-hidden="true">
      <FaBox size={size === "sm" ? 13 : size === "lg" ? 26 : 15} />
    </div>
  );
}
