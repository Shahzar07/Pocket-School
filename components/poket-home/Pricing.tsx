"use client";
import { homeText } from "./home-text";

import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  GraduationCap,
} from "lucide-react";
import { usePricing } from "@/hooks/use-pricing";
import { PLANS } from "@/lib/marketing/plan-copy";
import {
  discountLabel,
  formatMoney,
  quotePlan,
  type PricingConfig,
} from "@/lib/pricing";
import { CurrencySwitcher } from "@/components/currency-switcher";

/** The approved cards, connected to the same live prices as the checkout page. */
export default function Pricing() {
  const { config, currency, ready } = usePricing();
  return <PricingCards config={config} currency={currency} ready={ready} />;
}

export function PricingCards({
  config,
  currency,
  ready = true,
}: {
  config: PricingConfig;
  currency: string;
  ready?: boolean;
}) {
  const [annual, setAnnual] = useState(false);
  return (
    <section
      className="pricing-section pricing-explorer page-container section-space"
      id="pricing"
      aria-labelledby="pricing-heading"
      data-pricing-ready={ready ? "1" : "0"}
    >
      <div className="section-heading text-center" data-reveal>
        <h2 id="pricing-heading">{homeText("start_small_keep_going")}</h2>
        <p>
          {homeText("a_little_space_for_curiosity_a_clear_plan_for_what_come")}
        </p>
      </div>
      <div className="home-pricing-controls">
        <CurrencySwitcher />
        <div
          className="pricing-explorer__billing"
          role="group"
          aria-label={homeText("choose_billing_frequency")}
        >
          <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
            {homeText("monthly")}
          </button>
          <button aria-pressed={annual} onClick={() => setAnnual(true)}>
            {homeText("annually")}{" "}
            <span>
              {homeText("save")} {discountLabel(config)}
            </span>
          </button>
        </div>
      </div>
      <div className="pricing-explorer__grid home-pricing-grid">
        {PLANS.map((plan, index) => {
          const quote = quotePlan(
            config,
            plan.id,
            annual ? "annual" : "monthly",
            currency,
          );
          const amount = quote?.amount ?? null;
          const free = plan.id === "preview";
          const Icon =
            index === 0 ? Compass : index === 1 ? BookOpen : GraduationCap;
          return (
            <article
              className={`pricing-explorer__card ${plan.popular ? "pricing-explorer__card--featured" : ""}`}
              data-plan={plan.id}
              key={plan.id}
            >
              <div className="pricing-explorer__plan-header">
                <span className="pricing-explorer__plan-icon">
                  <Icon />
                </span>
                <span>
                  {plan.popular
                    ? "For your next chapter"
                    : free
                      ? "A little look around"
                      : "Room to grow"}
                </span>
              </div>
              <h3>{plan.name}</h3>
              <p className="pricing-explorer__description">{plan.tagline}</p>
              <div className="pricing-explorer__price">
                <span
                  className={`pricing-explorer__amount ${amount == null ? "home-price-unset" : ""}`}
                >
                  {amount == null
                    ? "Coming soon"
                    : formatMoney(amount, quote?.currency ?? currency)}
                </span>
                {!free && amount != null ? (
                  <span>/ {annual ? "year" : "month"}</span>
                ) : null}
              </div>
              <p className="pricing-explorer__billing-note">
                {free
                  ? "No card required."
                  : amount == null
                    ? "Pricing will appear when available."
                    : `Billed ${annual ? "annually" : "monthly"} · ${currency}`}
              </p>
              <a className="button" href={free ? "/signup" : `/pricing?billing=${annual ? "annual" : "monthly"}#plan-${plan.id}`}>
                {free ? "Start free" : "Explore this plan"}
                <ArrowRight />
              </a>
              <div className="pricing-explorer__divider" />
              <p className="pricing-explorer__features-title">
                {homeText("your_learning_essentials")}
              </p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check />
                    <span>{feature}</span>
                  </li>
                ))}
                <li>
                  <Check />
                  <span>
                    {free ? "First-lesson access" : "Learning pathway included"}
                  </span>
                </li>
              </ul>
            </article>
          );
        })}
      </div>
      <p className="pricing-explorer__other">
        {homeText("find_the_right_fit_for_your_family_or_school")}{" "}
        <a href="/pricing">
          {homeText("compare_all_plans")} <ArrowRight />
        </a>
        <span>·</span>
        <a href="/institutions/register">
          {homeText("explore_poket_for_schools")} <ArrowRight />
        </a>
      </p>
      <span className="sr-only" role="status">
        {annual
          ? "Annual billing selected. Prices are billed per year."
          : "Monthly billing selected."}
      </span>
    </section>
  );
}
