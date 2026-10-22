import Link from 'next/link';
import { OfferCta } from '@/components/reads-offer/cta';
import { OfferCurrencySelect, OfferMoney } from '@/components/reads-offer/money';
import { OfferShot } from '@/components/reads-offer/shot';
import { readsOfferExcerpts } from '@/lib/reads-offer-excerpts';
import {
  OFFER_BOOKS_3D,
  OFFER_COVERS,
  OFFER_DEVICES,
  OFFER_EBOOKS,
  OFFER_FAN,
} from '@/lib/reads-offer-media';
import { OfferTestimonials } from '@/components/reads-offer/testimonials';
import {
  READS_OFFER_BOOKS,
  READS_OFFER_CHECKOUTS,
  READS_OFFER_COMPANY_NO,
  READS_OFFER_ENTITY,
  READS_OFFER_FAQ,
  READS_OFFER_FOUNDER,
  READS_OFFER_LANGUAGE_COUNT,
  READS_OFFER_REVIEW_MAIL,
  READS_OFFER_TESTIMONIALS,
  bookCheckoutHref,
  booksVersusUnlimitedLine,
  ownOrReadLine,
  readsCheckoutHref,
  readsDailyUsd,
  readsMonthlyUsd,
  readsYearlyUsd,
  READS_BOOK_USD,
} from '@/lib/reads-offer';

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function ReadsOfferLetter() {
  const excerpts = readsOfferExcerpts();
  const academic = excerpts.filter(item => item.lane === 'academic');
  const stories = excerpts.filter(item => item.lane === 'story');
  const ownedTotal = READS_OFFER_BOOKS.reduce((sum, book) => sum + book.usd, 0);
  const year = new Date().getFullYear();

  return (
    <main id="top" className="bg-background text-foreground [color-scheme:light] dark:[color-scheme:dark]">
      <a href="#letter" className={`sr-only top-3 left-3 z-50 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground focus:not-sr-only focus:absolute ${focus}`}>
        Skip to the letter
      </a>

      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="#top" className={`font-heading text-[22px] tracking-[-0.04em] ${focus}`}>Poket Reads</Link>
          <p className="hidden text-sm text-muted-foreground sm:block">Sold on its own, by Poket School</p>
          <nav aria-label="On this page" className="ml-auto flex items-center gap-2 sm:gap-3">
            <a href="#price" className={`hidden text-sm font-semibold text-foreground sm:inline ${focus}`}>Price</a>
            <a href="#read" className={`hidden text-sm font-semibold text-foreground md:inline ${focus}`}>Read a page</a>
            <OfferCurrencySelect />
            <OfferCta href={readsCheckoutHref('reads', 'month')} id="header-subscribe">Subscribe</OfferCta>
          </nav>
        </div>
      </header>

      <div id="letter" className="mx-auto max-w-3xl px-4 pt-14 pb-4 sm:px-6 sm:pt-20">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">A shelf you can pay for from Malaysia</p>
        <h1 className="mt-4 font-heading text-[2.6rem] leading-[0.98] tracking-[-0.045em] text-foreground sm:text-6xl">
          Kindle Unlimited will not take your money in Malaysia.
        </h1>
        <p className="mt-6 text-xl leading-snug text-foreground sm:text-2xl">
          Amazon Kids+ will not either. Poket Reads is the shelf you subscribe to from here, or the single book you buy once and keep.
        </p>
        <p className="mt-6 text-[17px] leading-[1.7] text-muted-foreground">
          {ownOrReadLine()} ({readsMoneyWords(readsYearlyUsd('reads'))} a year).
          Reads Family, for more than one profile, is {readsMoneyWords(readsMonthlyUsd('reads-family'))} a month or {readsMoneyWords(readsYearlyUsd('reads-family'))} a year.
          {booksVersusUnlimitedLine()}. The monthly price is less than a coffee. The figure on the cards below follows the currency you choose. US dollars are the price we store.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <OfferCta href={readsCheckoutHref('reads', 'month')} id="hero-reads">Get Poket Reads</OfferCta>
          <OfferCta href={readsCheckoutHref('reads-family', 'month')} id="hero-family" variant="secondary">Get Reads Family</OfferCta>
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6" aria-labelledby="hook-title">
        <h2 id="hook-title" className="font-heading text-4xl tracking-[-0.04em] sm:text-5xl">If the button never appears, the book was never really for sale.</h2>
        <div className="mt-6 space-y-5 text-[17px] leading-[1.7]">
          <p>
            You have the reading list. A novel someone actually wants to finish. A biology title the syllabus named. A picture book for the youngest, and a contract chapter that has to sound like English rather than a statute.
          </p>
          <p>
            Then you open the service everyone else seems to use, and the subscription is not offered in Malaysia. Kindle Unlimited is not sold here. Amazon Kids+ is not sold here. The bookshop may have a copy, at a price that makes a weekly shop look gentle. Or it may not have it at all.
          </p>
          <p>
            The frustrating part is not the desire to read. The frustrating part is paying.
          </p>
        </div>
        <div className="mt-8">
          <OfferCta href="#price" id="hook-price" variant="quiet">See the real price</OfferCta>
        </div>
      </section>

      <section className="bg-card" aria-labelledby="story-title">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">How this started</p>
          <h2 id="story-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">A parent, a student, and a checkout that stopped at the border.</h2>
          <div className="mt-6 space-y-5 text-[17px] leading-[1.7]">
            <p>
              Picture a parent in Malaysia trying to put the right books in front of a child without turning the month into a pile of imports. The child is not short of curiosity. The student, a little older, already knows the story they want. They found it on a shelf that will not take a Malaysian card for the subscription.
            </p>
            <p>
              So the evening goes the way these evenings go. One tab for the syllabus. One tab for a novel. One tab for a children’s book that does not talk down. And a price, when there is a price, that belongs to a different country. The parent is not failing at reading. The student is not failing at wanting a book. The vehicle is wrong.
            </p>
            <p>
              The moment it became obvious was small. The books existed. The household was willing to pay. The service that rented those books to the rest of the world simply did not sell that rental here. A cheaper coupon for a shop that will not serve you is not a plan. A shelf that is actually sold here is a different opportunity.
            </p>
            <p>
              That is Poket Reads. Not a code for Kindle. A shelf of our own: stories, general non-fiction, and academic books tagged for the paths students here actually walk. You subscribe for the reading shelf, or you buy one book and keep it. You pay by card, or by FPX, GrabPay, Touch &apos;n Go, Boost, ShopeePay or DuitNow, when checkout offers that method for your country and currency.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="opportunity-title">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">The new opportunity</p>
        <h2 id="opportunity-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">Stop waiting for someone else’s library to open in Kuala Lumpur.</h2>
        <div className="mt-6 space-y-5 text-[17px] leading-[1.7]">
          <p>
            The old opportunity was “join the big subscription, if it is sold in your country”. It is not. Treating that as a personal failure, or as a reason to give up on a reading habit, misses what actually broke.
          </p>
          <p>
            The new opportunity is a local shelf. Poket Reads is a Netflix-style subscription for books, and it is also a bookshop for the titles you would rather own. Academic books are tagged Primary, Lower Secondary, IGCSE, A-Level and LLB. Beside them sit novels, general non-fiction and children’s stories.
          </p>
          <p>
            Be precise about what the subscription opens. Poket Reads, at the price on this page, is the Primary and Lower Secondary shelf, plus general fiction and non-fiction on that shelf. IGCSE, A-Level and LLB books live on the same shelf so you can sample the first chapter and buy the ones you want to keep. They are not quietly bundled into the nine-dollar month. Poket School’s own IGCSE and A-Level plan is a different product, with a different checkout.
          </p>
          <p>
            Inside a chapter, Ask ET stays with what you have already read. It will not spoil the next page to sound clever. Quizzes at the end of a chapter are written the same way. From a book, ET AI can make flashcards, a mind map and a summary. The reader itself has light, sepia and dark themes, a dyslexia-friendly typeface, and offline reading. Goals and streaks are there for the nights when a chapter is enough.
          </p>
        </div>
      </section>

      <section className="bg-secondary" aria-labelledby="secrets-title">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Three false beliefs</p>
          <h2 id="secrets-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">The obstacle was never “people here do not read”.</h2>
          <ol className="mt-10 space-y-12">
            <li>
              <p className="text-sm font-bold text-primary">Secret one. The vehicle.</p>
              <h3 className="mt-2 font-heading text-3xl tracking-[-0.03em]">“A reading subscription is an American product, so it will never work for us.”</h3>
              <p className="mt-4 text-[17px] leading-[1.7]">
                That belief felt true because the famous vehicle does not sell here. The desire was fine. The shop was closed. Poket Reads is sold as its own product, in the currency this site already uses, through the same checkout as the rest of Poket. You are not borrowing someone else’s membership. You are joining a shelf that expects a Malaysian payment.
              </p>
            </li>
            <li>
              <p className="text-sm font-bold text-primary">Secret two. The person.</p>
              <h3 className="mt-2 font-heading text-3xl tracking-[-0.03em]">“I am not a reader, and my child will not stick with a book.”</h3>
              <p className="mt-4 text-[17px] leading-[1.7]">
                Most reading products are designed for people who already read. This one also has to work on a Tuesday when fifteen minutes is a win. Set a goal. Keep a streak. Change the type if the letters swim. Save a chapter for the car or a classroom with a sulky connection. On Reads Family, a child’s profile hides books that are too old for them, and the leaderboards use nicknames for minors, whether the board is the world, a country or a school. A parent profile can see reading time and books finished, and a parent can be alerted when a goal is still open the next day.
              </p>
            </li>
            <li>
              <p className="text-sm font-bold text-primary">Secret three. The outside world.</p>
              <h3 className="mt-2 font-heading text-3xl tracking-[-0.03em]">“The books we need are not on any service I can join.”</h3>
              <p className="mt-4 text-[17px] leading-[1.7]">
                This one was partly true, and it is the reason the page exists. Kindle Unlimited and Amazon Kids+ are not sold in Malaysia, so “just subscribe” was never an instruction you could follow. Poket Reads publishes into that gap. New titles are reviewed by a person before they go on the shelf. The interface speaks {READS_OFFER_LANGUAGE_COUNT} languages, and a book can be translated instead of being swapped for a different book. The titles below are ones you can open today, not a promise of a catalogue we have not printed.
              </p>
            </li>
          </ol>
          <div className="mt-10">
            <OfferCta href={readsCheckoutHref('reads-family', 'year')} id="secrets-family">See Reads Family yearly</OfferCta>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="devices-title">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">The product, not a sketch</p>
          <h2 id="devices-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">The shelf, the page, and Ask ET.</h2>
          <p className="mt-4 text-[17px] leading-[1.7] text-muted-foreground">
            These are the running Reads screens, with the books that ship in the catalogue. The phone is the shelf. The tablet is the reader. The laptop is Ask ET beside the chapter.
          </p>
        </div>
        <ul className="mt-10 grid gap-8 lg:grid-cols-3">
          {OFFER_DEVICES.map(device => (
            <li key={device.src} className="overflow-hidden rounded-3xl bg-[#F4F6F6] ring-1 ring-border">
              <OfferShot src={device.src} alt={device.alt} width={device.width} height={device.height} sizes="(min-width: 1024px) 30vw, 100vw" />
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card" aria-labelledby="covers-title">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Covers from the catalogue</p>
            <h2 id="covers-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">Academic books and the ones you read for the story.</h2>
            <p className="mt-4 text-[17px] leading-[1.7] text-muted-foreground">
              Every cover here is a published Poket Reads title. There is no invented A-Level jacket. A-Level is a tag the shelf uses. The books you can see are Primary, Lower Secondary, IGCSE, LLB, a novel, a history and a picture book.
            </p>
          </div>
          <figure className="mt-10">
            <OfferShot src={OFFER_FAN.src} alt={OFFER_FAN.alt} width={OFFER_FAN.width} height={OFFER_FAN.height} sizes="(min-width: 1024px) 960px, 100vw" />
            <figcaption className="mt-3 text-sm text-muted-foreground">The published shelf, fanned.</figcaption>
          </figure>
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {OFFER_COVERS.map(cover => (
              <li key={cover.id}>
                <OfferShot src={cover.src} alt={cover.alt} width={cover.width} height={cover.height} sizes="(min-width: 1024px) 160px, 45vw" className="rounded-lg shadow-[var(--shadow-card)]" />
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">{cover.label}</p>
              </li>
            ))}
          </ul>
          <div className="mt-12 grid items-end gap-8 md:grid-cols-2">
            {OFFER_BOOKS_3D.map(book => (
              <figure key={book.src}>
                <OfferShot src={book.src} alt={book.alt} width={book.width} height={book.height} sizes="(min-width: 768px) 40vw, 100vw" />
              </figure>
            ))}
          </div>
          <div className="mt-8 grid items-end gap-8 md:grid-cols-2">
            {OFFER_EBOOKS.map(book => (
              <figure key={book.src}>
                <OfferShot src={book.src} alt={book.alt} width={book.width} height={book.height} sizes="(min-width: 768px) 40vw, 80vw" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="read" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="read-title">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Read a page</p>
        <h2 id="read-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">The opening, from the book, not from the advert.</h2>
        <p className="mt-4 text-[17px] leading-[1.7] text-muted-foreground">
          These are the first paragraphs of published chapters. Academic books on one tab. Stories on the other.
        </p>
        <fieldset className="mt-8 flex flex-wrap gap-2">
          <legend className="sr-only">Choose academic books or stories</legend>
          <input id="excerpt-academic" name="reads-excerpt" type="radio" defaultChecked className="peer/academic sr-only" />
          <input id="excerpt-stories" name="reads-excerpt" type="radio" className="peer/stories sr-only" />
          <label htmlFor="excerpt-academic" className={`inline-flex h-11 cursor-pointer items-center rounded-full bg-foreground px-4 text-sm font-bold text-background peer-focus-visible/academic:outline peer-focus-visible/academic:outline-2 peer-focus-visible/academic:outline-offset-2 peer-focus-visible/academic:outline-primary peer-checked/stories:bg-card peer-checked/stories:text-foreground peer-checked/stories:ring-1 peer-checked/stories:ring-border ${focus}`}>
            Academic
          </label>
          <label htmlFor="excerpt-stories" className={`inline-flex h-11 cursor-pointer items-center rounded-full bg-card px-4 text-sm font-bold text-foreground ring-1 ring-border peer-checked/stories:bg-foreground peer-checked/stories:text-background peer-checked/stories:ring-0 peer-focus-visible/stories:outline peer-focus-visible/stories:outline-2 peer-focus-visible/stories:outline-offset-2 peer-focus-visible/stories:outline-primary ${focus}`}>
            Stories
          </label>
          <ExcerptList items={academic} named="academic" />
          <ExcerptList items={stories} named="stories" />
        </fieldset>
      </section>

      <section className="bg-card" aria-labelledby="stack-title">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">What you are buying</p>
          <h2 id="stack-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">The books and the shelf, priced only where we have a price.</h2>
          <p className="mt-4 text-[17px] leading-[1.7]">
            The shelf price for a book is {readsMoneyWords(READS_BOOK_USD)}. {booksVersusUnlimitedLine()}. Each title below uses the price stored for that book. Buying each of them once comes to {readsMoneyWords(ownedTotal)}. That is the cost of owning those files, not a value of the subscription. The subscription does not include the LLB book or the IGCSE book.
          </p>
          <ul className="mt-8 divide-y divide-border rounded-3xl border border-border bg-background">
            {READS_OFFER_BOOKS.map(book => (
              <li key={book.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold">{book.title}</p>
                  <p className="text-sm text-muted-foreground">Buy once. Keep it.</p>
                </div>
                <div className="flex items-center gap-3">
                  <OfferMoney usd={book.usd} />
                  <OfferCta href={bookCheckoutHref(book.id)} id={`buy-${book.id}`} variant="quiet">Buy</OfferCta>
                </div>
              </li>
            ))}
            <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-semibold">Poket Reads shelf</p>
                <p className="text-sm text-muted-foreground">Primary, Lower Secondary, general fiction and non-fiction, children’s stories.</p>
              </div>
              <OfferMoney usd={readsMonthlyUsd('reads')} cadence="a month" />
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-semibold">Reads Family</p>
                <p className="text-sm text-muted-foreground">Several profiles. Children’s profiles filtered by age. Parent view of reading time.</p>
              </div>
              <OfferMoney usd={readsMonthlyUsd('reads-family')} cadence="a month" />
            </li>
          </ul>
          <ul className="mt-8 space-y-3 text-[17px] leading-relaxed">
            <li>Ask ET in the chapter you have open, without spoilers, plus chapter quizzes written the same way.</li>
            <li>Flashcards, a mind map and a summary from a book.</li>
            <li>Themes, a dyslexia-friendly typeface, offline chapters, goals and streaks.</li>
            <li>Kid-safe leaderboards. Nicknames for under-18s. Global, country or school.</li>
            <li>{READS_OFFER_LANGUAGE_COUNT} languages, and translations of books. A person reviews a title before it is published.</li>
          </ul>
        </div>
      </section>

      <section id="price" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="price-title">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">The price</p>
          <h2 id="price-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">Four ways to pay. No clock in the corner.</h2>
          <p className="mt-4 text-[17px] leading-[1.7] text-muted-foreground">
            {ownOrReadLine()}. {booksVersusUnlimitedLine()}. Spread over 30 days, the monthly price is about {readsMoneyWords(readsDailyUsd('reads'))} a day. The yearly price is the figure on the yearly card. It does not expire tonight. Choose a currency above if you want the local figure. Checkout uses the same pricing library.
          </p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {READS_OFFER_CHECKOUTS.map(item => (
            <li key={item.id} className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{item.audience}</p>
                  <h3 className="mt-2 font-heading text-3xl tracking-[-0.03em]">{item.name}</h3>
                </div>
                {item.badge ? <p className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">{item.badge}</p> : null}
              </div>
              <p className="mt-4 text-3xl font-bold tracking-[-0.03em]"><OfferMoney usd={item.usd} cadence={item.cadence} /></p>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted-foreground">{item.detail}</p>
              <div className="mt-6">
                <OfferCta href={readsCheckoutHref(item.sku, item.interval)} id={item.id}>{item.cta}</OfferCta>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted" aria-labelledby="founder-title">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Founder&apos;s note</p>
          <h2 id="founder-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">A note from {READS_OFFER_FOUNDER.name}.</h2>
          <div className="mt-6 space-y-5 text-[17px] leading-[1.7]">
            {READS_OFFER_FOUNDER.paragraphs.map(paragraph => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-8 text-sm font-semibold text-foreground">{READS_OFFER_FOUNDER.name}</p>
          <p className="text-sm text-muted-foreground">{READS_OFFER_FOUNDER.role}</p>
        </div>
      </section>

      <ReadPageCallout excerpts={excerpts} />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="first-title">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Reviews</p>
        <h2 id="first-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">Be one of our first readers.</h2>
        <p className="mt-4 text-[17px] leading-[1.7] text-muted-foreground">
          There are no reader reviews on this page. If you subscribe, or you buy a book, write and tell us what you thought. A review we can publish, in your words and with your permission, can be added here. Until then, this list stays empty.
        </p>
        <div className="mt-8">
          <a
            href={`mailto:${READS_OFFER_REVIEW_MAIL}?subject=${encodeURIComponent('Poket Reads review')}`}
            className={`inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-5 text-center text-sm font-bold text-foreground ${focus}`}
          >
            Write to {READS_OFFER_REVIEW_MAIL}
          </a>
        </div>
        <OfferTestimonials items={READS_OFFER_TESTIMONIALS} />
      </section>

      <section className="bg-card" aria-labelledby="faq-title">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 id="faq-title" className="font-heading text-4xl tracking-[-0.04em] sm:text-5xl">Questions worth answering before you pay.</h2>
          <div className="mt-8 divide-y divide-border">
            {READS_OFFER_FAQ.map(item => (
              <details key={item.question} className="group py-1">
                <summary className={`cursor-pointer py-4 text-[17px] font-semibold marker:text-primary ${focus}`}>
                  {item.question}
                </summary>
                <p className="pb-4 text-[16px] leading-[1.7] text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="close-title">
        <h2 id="close-title" className="font-heading text-4xl tracking-[-0.04em] sm:text-5xl">The border is still there. The shelf is on this side of it.</h2>
        <p className="mt-4 text-[17px] leading-[1.7]">
          If you wanted a subscription and the button was missing, you were not imagining the gap. Poket Reads is the thing you can start tonight: one reader, or a household, or a single book you keep.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <OfferCta href={readsCheckoutHref('reads', 'year')} id="close-reads-year">Reads, yearly</OfferCta>
          <OfferCta href={readsCheckoutHref('reads-family', 'year')} id="close-family-year" variant="secondary">Family, yearly</OfferCta>
          <OfferCta href="/reads" id="close-shelf" variant="quiet">Browse the shelf</OfferCta>
        </div>
        <p className="mt-10 text-[17px] leading-[1.7]">
          <strong>P.S.</strong> Kindle Unlimited and Amazon Kids+ are still not sold in Malaysia. The yearly price on this page is not a launch timer. It is the yearly price on the card.
        </p>
        <p className="mt-4 text-[17px] leading-[1.7]">
          <strong>P.P.S.</strong> A book you buy stays after the subscription ends. The first chapter of a published book is free to read before you pay anyone.
        </p>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {year} {READS_OFFER_ENTITY} ({READS_OFFER_COMPANY_NO}). Poket Reads is a Poket School product.</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/legal?doc=privacy" prefetch={false} className={`font-semibold text-foreground ${focus}`}>Privacy</Link>
            <Link href="/legal?doc=terms" prefetch={false} className={`font-semibold text-foreground ${focus}`}>Terms</Link>
            <Link href="/legal?doc=cookies" prefetch={false} className={`font-semibold text-foreground ${focus}`}>Cookies</Link>
            <Link href="/" prefetch={false} className={`font-semibold text-foreground ${focus}`}>Poket School</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function firstSentence(paragraph: string): string {
  const match = paragraph.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (match ? match[0] : paragraph).trim();
}

function ReadPageCallout({ excerpts }: { excerpts: ReturnType<typeof readsOfferExcerpts> }) {
  const pulls = ['cells-to-systems', 'harbour-light']
    .map(id => excerpts.find(item => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="callout-title">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Read a page</p>
      <h2 id="callout-title" className="mt-3 font-heading text-4xl tracking-[-0.04em] sm:text-5xl">A line from the book, before you take our word for it.</h2>
      <p className="mt-4 text-[17px] leading-[1.7] text-muted-foreground">
        One academic opening and one story. Each line is the first sentence of a published chapter.
      </p>
      <ul className="mt-8 space-y-6">
        {pulls.map(item => (
          <li key={item.id} className="rounded-3xl border border-border bg-card px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{item.kicker}</p>
            <blockquote className="mt-3 text-[17px] leading-[1.7]">“{firstSentence(item.paragraphs[0] ?? '')}”</blockquote>
            <p className="mt-3 text-sm text-muted-foreground">{item.title}. {item.chapter}.</p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <a href="#read" className={`inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-bold text-foreground ${focus}`}>
          Read the openings
        </a>
      </div>
    </section>
  );
}

function readsMoneyWords(usd: number): string {
  return `${usd.toFixed(2)} US dollars`;
}

function ExcerptList({ items, named }: { items: ReturnType<typeof readsOfferExcerpts>; named: 'academic' | 'stories' }) {
  const hidden = named === 'academic'
    ? 'basis-full peer-checked/stories:hidden'
    : 'basis-full hidden peer-checked/stories:block';
  return (
    <div aria-label={named === 'academic' ? 'Academic excerpts' : 'Story excerpts'} className={`mt-6 space-y-10 ${hidden}`}>
      {items.map(item => (
        <article key={item.id} className="border-t border-border pt-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{item.kicker}</p>
          <h3 className="mt-2 font-heading text-3xl tracking-[-0.03em]">{item.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.chapter}</p>
          <div className="mt-4 space-y-4 text-[17px] leading-[1.75]">
            {item.paragraphs.map(paragraph => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <OfferCta href={item.readerHref} id={`read-${item.id}`} variant="quiet">Continue in the reader</OfferCta>
            {item.usd > 0 ? (
              <OfferCta href={bookCheckoutHref(item.id)} id={`excerpt-buy-${item.id}`}>Buy this book</OfferCta>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
