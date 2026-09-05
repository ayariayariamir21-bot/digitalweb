import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { ColorSortGame } from "@/components/ColorSortGame";

export default function ColorSortPage() {
  return <div className="game-page"><div className="container"><Link href="/children" className="back-link"><ArrowLeft size={15} /> Children’s room</Link><section className="game-intro"><p className="eyebrow children-eyebrow"><span className="eyebrow-line" />A tiny game for curious minds</p><h1>Color <em>Sort.</em></h1><p>Pick a shape, then place it in the basket with the matching color. Take your time — this is play, not a race.</p></section><ColorSortGame /><p className="game-note">For ages 5–8 · No ads · No public chat · Designed for a grown-up to play alongside.</p></div></div>;
}


