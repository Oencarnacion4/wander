import { ArrowRight, BadgeCheck, Clock, Compass, Home, MapPinned, Plane, Scale, Users } from "lucide-react";
import Link from "next/link";
import { Photo } from "@/components/Photo";

const FEATURES = [
  {
    href: "/explore",
    eyebrow: "Explore My City",
    title: "A plan for today, in minutes.",
    body: "Time, budget, who's coming, how you're getting around. WANDER finds real places nearby and builds an itinerary that fits.",
    photo: "Millennium Park",
    icon: Compass,
    hue: 20,
  },
  {
    href: "/somewhere",
    eyebrow: "Take Me Somewhere",
    title: "Don't know where to go? Good.",
    body: "Tell us your dates, budget and how far you'll travel — at home or abroad. Or hit Surprise Me.",
    photo: "Lisbon",
    icon: Plane,
    hue: 200,
  },
  {
    href: "/adventures",
    eyebrow: "My Adventures",
    title: "Every place you've been, mapped.",
    body: "Save places you want to try, log every visit (yes, go back to your favorite bowling alley), and watch your map grow.",
    photo: "Yosemite Valley",
    icon: MapPinned,
    hue: 120,
  },
];

const FACTORS = [
  { icon: Users, title: "Your group", body: "Kids' ages, group size and who it's right for." },
  { icon: Scale, title: "Your budget", body: "Per person or for everyone. Prices are labeled estimate or confirmed." },
  { icon: Clock, title: "Your time", body: "Opening hours, travel time between stops and how long each visit takes." },
  { icon: BadgeCheck, title: "Real places only", body: "Every place comes from OpenStreetMap. We never invent businesses or prices." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative">
        <Photo title="Bora Bora" className="h-[78vh] min-h-[520px] max-h-[760px]" fallbackHue={15}>
          <div className="absolute inset-0 bg-gradient-to-b from-plum-dark/30 via-plum-dark/35 to-plum-dark/85" />
          <div className="absolute inset-0 topo opacity-60" />
          <div className="relative h-full mx-auto max-w-7xl px-4 md:px-6 flex flex-col justify-end pb-14 md:pb-20">
            <p className="rise text-lilac font-semibold tracking-[0.25em] uppercase text-xs md:text-sm">Discover · Plan · Remember</p>
            <h1 className="rise font-display text-white text-5xl sm:text-6xl md:text-8xl font-extrabold leading-[0.92] mt-3 max-w-4xl">
              Less Planning.
              <br />
              <span className="italic font-medium text-lilac">More Living.</span>
            </h1>
            <p className="rise rise-2 text-white/80 text-lg md:text-xl mt-5 max-w-xl">Real places, realistic plans, and a map of everywhere you&apos;ve been. Built around your time, your budget, and your people.</p>
            <div className="rise rise-3 mt-8 flex flex-wrap gap-3">
              <Link href="/explore" className="inline-flex items-center gap-2 rounded-full bg-orchid hover:bg-orchid-dark text-white font-semibold px-6 py-3.5 shadow-lift transition-colors">
                <Compass className="size-5" /> Explore my city
              </Link>
              <Link href="/somewhere" className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white font-semibold px-6 py-3.5 transition-colors">
                <Plane className="size-5" /> Take me somewhere
              </Link>
            </div>
          </div>
        </Photo>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-16 md:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl md:text-5xl font-extrabold leading-tight">Where do you even start? Right here.</h2>
          <p className="text-ink-soft mt-4 text-lg">What makes sense depends on who you&apos;re with, what you want to spend, and how much time you&apos;ve got. WANDER weighs all of it for you.</p>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href} className="group rounded-[28px] overflow-hidden bg-card border border-line shadow-card hover:shadow-lift hover:-translate-y-1 duration-500">
              <Photo title={f.photo} className="h-56 [&>img]:transition-transform [&>img]:duration-700 group-hover:[&>img]:scale-105" fallbackHue={f.hue}>
                <div className="absolute inset-0 bg-gradient-to-t from-plum-dark/70 to-transparent" />
                <span className="absolute left-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-white/90 text-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide">
                  <f.icon className="size-3.5" /> {f.eyebrow}
                </span>
              </Photo>
              <div className="p-6">
                <h3 className="font-display text-2xl font-bold leading-tight">{f.title}</h3>
                <p className="text-ink-soft mt-2">{f.body}</p>
                <p className="mt-4 inline-flex items-center gap-1.5 font-semibold text-orchid group-hover:gap-2.5 transition-all">
                  Get started <ArrowRight className="size-4" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="plum-band text-white topo">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-lilac font-semibold text-sm tracking-widest uppercase">Not a chatbot</p>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold leading-tight mt-2">A recommendation engine you can actually explain.</h2>
            <p className="text-white/75 mt-4 text-lg">
              Every place gets a score from seven measurable factors — interest match, distance, cost, group fit, time of day, data quality and novelty. Then an optimizer builds the best itinerary that fits opening hours, travel time and your budget.
            </p>
            <p className="text-white/75 mt-4">Tap &quot;Why this?&quot; on any stop to see exactly how it was scored.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {FACTORS.map((f) => (
              <div key={f.title} className="rounded-3xl bg-white/[0.06] border border-white/10 p-5">
                <f.icon className="size-6 text-lilac" />
                <h3 className="font-display text-lg font-bold mt-3">{f.title}</h3>
                <p className="text-white/70 text-sm mt-1">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Home Base CTA */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-16 md:py-24">
        <div className="rounded-[32px] bg-mist border border-line p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="size-12 rounded-2xl bg-plum text-white grid place-items-center shrink-0">
              <Home className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold">Set your Home Base</h2>
              <p className="text-ink-soft mt-1 max-w-xl">It becomes your default starting point. Exploring another city never changes it.</p>
            </div>
          </div>
          <Link href="/home-base" className="inline-flex items-center justify-center gap-2 rounded-full bg-plum text-white font-semibold px-6 py-3.5 hover:bg-plum-dark transition-colors">
            Set it up <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
