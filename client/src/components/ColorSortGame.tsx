import { useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";

type Color = "teal" | "orange" | "violet";
type Token = { id: number; color: Color; shape: "circle" | "square" | "triangle" | "diamond" | "star" };

const colors: Color[] = ["teal", "orange", "violet"];
const shapes: Token["shape"][] = ["circle", "square", "triangle", "diamond", "star", "circle"];
const makeTokens = () => shapes.map((shape, id) => ({ id, shape, color: colors[id % colors.length] }));

export function ColorSortGame() {
  const [tokens, setTokens] = useState<Token[]>(makeTokens);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [message, setMessage] = useState("Choose a shape, then choose its matching basket.");
  const won = tokens.length === 0;
  const gameOver = lives === 0;
  const sortedCount = 6 - tokens.length;
  const reset = () => { setTokens(makeTokens()); setSelected(null); setScore(0); setLives(3); setMessage("Choose a shape, then choose its matching basket."); };
  const chooseToken = (id: number) => { if (!won && !gameOver) { setSelected(id); setMessage("Now choose the basket with the same color."); } };
  const chooseBasket = (color: Color) => {
    if (selected === null || won || gameOver) return;
    const token = tokens.find((item) => item.id === selected);
    if (!token) return;
    if (token.color === color) {
      setTokens((current) => current.filter((item) => item.id !== selected));
      setSelected(null);
      setScore((current) => current + 20);
      setMessage(tokens.length === 1 ? "Wonderful! You sorted every shape." : "Nice match! Pick another shape.");
    } else {
      setLives((current) => Math.max(0, current - 1));
      setSelected(null);
      setMessage(lives <= 1 ? "That was the last try. Press Restart to play again." : "Almost! Try matching the colors.");
    }
  };
  return <div className="color-sort-game" aria-label="Color Sort mini-game"><div className="color-sort-top"><div className="color-sort-score"><Sparkles size={17} /> <span>SCORE</span><strong>{score}</strong></div><div className="color-sort-title">COLOR <em>SORT</em></div><div className="color-sort-actions"><span className="color-sort-lives" aria-label={`${lives} lives remaining`}>{[0, 1, 2].map((life) => <span className={life < lives ? "heart is-active" : "heart"} key={life}>♥</span>)}</span><button type="button" onClick={reset}><RotateCcw size={15} /> Restart</button></div></div><div className="color-sort-board"><div className="color-sort-instruction" aria-live="polite">{message}</div><div className="color-sort-tokens">{tokens.length && !gameOver ? tokens.map((token) => <button type="button" aria-label={`${token.color} ${token.shape}${selected === token.id ? ", selected" : ""}`} className={`sort-token token-${token.color} token-${token.shape} ${selected === token.id ? "is-selected" : ""}`} onClick={() => chooseToken(token.id)} key={token.id}><span /></button>) : <div className="color-sort-win">{won ? "You did it!" : "Good try!"}<small>{won ? `${sortedCount} shapes sorted` : "Press Restart for another round"}</small></div>}</div><div className="color-sort-baskets">{colors.map((color) => <button type="button" disabled={gameOver || won} aria-label={`Place shape in ${color} basket`} className={`sort-basket basket-${color}`} onClick={() => chooseBasket(color)} key={color}><span className="basket-rim" /><span className="basket-label">{color}</span></button>)}</div></div><img className="color-sort-reference" src="/manus-storage/color-sort-reference_f22baff2.png" alt="Color Sort game illustration with colorful shapes and baskets" /></div>;
}
