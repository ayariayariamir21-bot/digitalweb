import { FormEvent, useState } from "react";
import { ArrowUpRight, Check, Mail } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const subscribe = trpc.marketing.subscribe.useMutation({ onSuccess: () => { setSubmitted(true); setEmail(""); } });
  const handleSubmit = (event: FormEvent) => { event.preventDefault(); subscribe.mutate({ email }); };

  return <div className="signup-page"><section className="signup-hero"><div className="container signup-hero-inner"><p className="eyebrow"><span className="eyebrow-line" />Stay in the loop</p><h1>A little note<br /><em>when it matters.</em></h1><p>Get occasional updates when a new book, tool, story, or small experiment is ready.</p></div></section><section className="signup-section section-pad"><div className="container signup-grid"><div className="signup-copy"><p className="eyebrow"><span className="eyebrow-line" />The quiet inbox</p><h2>No password.<br /><em>No noise.</em></h2><p>This is a simple newsletter signup, not a customer account. We only use your email to send Amir Digital updates, and you can unsubscribe whenever you like.</p><ul><li><Check size={16} />New product releases</li><li><Check size={16} />Notes on thoughtful making</li><li><Check size={16} />Stories and play for younger readers</li></ul></div><form className="signup-card" onSubmit={handleSubmit}><Mail size={22} /><h2>Join the list</h2>{submitted ? <div className="signup-success"><Check size={18} /><p>You’re on the list. Thanks for joining.</p></div> : <><label htmlFor="signup-name">Your name <span>optional</span></label><input id="signup-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" /><label htmlFor="signup-email">Email address</label><input id="signup-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /><button className="button button-primary" type="submit" disabled={subscribe.isPending}>{subscribe.isPending ? "Joining…" : <>Join Amir Digital <ArrowUpRight size={16} /></>}</button><small>By joining, you agree to receive occasional Amir Digital emails.</small></>}</form></div></section><section className="signup-bottom"><div className="container"><p>Looking for a product instead?</p><Link href="/buy">Browse the Buy Now page <ArrowUpRight size={15} /></Link></div></section></div>;
}


