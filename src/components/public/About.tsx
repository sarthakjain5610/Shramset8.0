import React from 'react';
import {
  Award,
  MapPin,
  Scale,
  ArrowRight,
  Sparkles,
  Users,
  Building2,
  Target,
  BookOpen,
  HeartHandshake,
} from 'lucide-react';
import { AppRoute } from '../../services/router';
import { Language } from '../../services/i18n';
import { PageHeader } from '../ui/PageHeader';
import { Reveal } from '../ui/Reveal';
import { LanguageNotice } from '../ui/LanguageNotice';
import { SectionHeading } from '../ui/SectionHeading';
import { CountUp } from '../ui/CountUp';

interface AboutProps {
  onNavigate: (route: AppRoute) => void;
  lang: Language;
}

const PRINCIPLES = [
  {
    icon: Users,
    title: { en: 'Worker-first defaults', hi: 'श्रमिक-प्राथमिक डिफ़ॉल्ट' },
    body: {
      en: 'Hindi is the default language, the helpline is on every screen, and no feature depends on the worker owning a smartphone beyond a basic browser.',
      hi: 'हिंदी डिफ़ॉल्ट भाषा है, हेल्पलाइन हर स्क्रीन पर है, और कोई भी सुविधा श्रमिक से स्मार्टफ़ोन माँगने पर निर्भर नहीं है — सामान्य ब्राउज़र पर्याप्त है।',
    },
  },
  {
    icon: Scale,
    title: { en: 'Statute over opinion', hi: 'अधिनियम, राय नहीं' },
    body: {
      en: 'Wage maths follows the MP Minimum Wages Act bands. The platform never invents a rate, and every computed figure can be traced back to a published band.',
      hi: 'मजदूरी की गणना मध्य प्रदेश न्यूनतम मजदूरी अधिनियम की श्रेणियों के अनुसार होती है। मंच कोई दर नहीं गढ़ता और हर आंकड़ा प्रकाशित श्रेणी तक वापस जाँचा जा सकता है।',
    },
  },
  {
    icon: BookOpen,
    title: { en: 'Inspectable by design', hi: 'डिज़ाइन से ही जाँच-योग्य' },
    body: {
      en: 'The cryptographic audit bench is a public part of the demo. Judges, officers and workers can all run the same verification, not just the author.',
      hi: 'क्रिप्टोग्राफ़िक ऑडिट बेंच डेमो का सार्वजनिक हिस्सा है। जज, अधिकारी और श्रमिक — सभी वही सत्यापन चला सकते हैं, केवल लेखक नहीं।',
    },
  },
  {
    icon: HeartHandshake,
    title: { en: 'No extraction', hi: 'कोई शोषण नहीं' },
    body: {
      en: 'There is no data resale, no credit scoring and no paid tier for workers. Records belong to the worker who generated them.',
      hi: 'डेटा की पुनर्बिक्री नहीं, क्रेडिट स्कोरिंग नहीं और श्रमिकों के लिए कोई सशुल्क स्तर नहीं। रिकॉर्ड उसी श्रमिक का है जिसने उसे बनाया।',
    },
  },
];

export const About: React.FC<AboutProps> = ({ onNavigate, lang }) => {  // Bilingual helper: every user-facing string in this component is authored in
  // both languages, so a Hindi reader never sees an English fragment.
  const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);

  return (
    <div className="pb-4">
      <LanguageNotice lang={lang} />

      <PageHeader
        eyebrow={tr('About the project', 'परियोजना के बारे में')}
        icon={<Award className="h-5 w-5" />}
        title={
          <>
            Built in Indore, for the people who{' '}
            <span className="italic text-forest-700">{tr('build Indore', 'इंदौर बनाते हैं')}</span>
          </>
        }
        description={tr(
          "WurkUp began as a field observation: the only record of a construction worker's month is a diary kept by the person who owes them money. This is our attempt to give both sides the same page.",
          'WURK UP की शुरुआत एक ज़मीनी अनुभव से हुई: निर्माण श्रमिक के महीने का एकमात्र रिकॉर्ड वह डायरी है जिसे वही व्यक्ति रखता है जिसे उसका पैसा देना है। यह हमारी कोशिश है कि दोनों पक्षों को एक ही पन्ना मिले।'
        )}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brass-300/70 bg-brass-50/80 px-3 py-1.5 text-[10.5px] font-bold text-brass-900">
            <Award className="h-3 w-3" /> {tr('Senior Bal Vigyan · Division II', 'सीनियर बाल विज्ञान · डिवीजन II')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white/80 px-3 py-1.5 text-[10.5px] font-bold text-ink-600">
            <MapPin className="h-3 w-3 text-forest-700" /> {tr('Indore, Madhya Pradesh', 'इंदौर, मध्य प्रदेश')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white/80 px-3 py-1.5 text-[10.5px] font-bold text-ink-600">
            <Sparkles className="h-3 w-3 text-brass-600" /> {tr('Applied digital solutions', 'व्यावहारिक डिजिटल समाधान')}
          </span>
        </div>
      </PageHeader>

      {/* Origin story */}
      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div className="prose-editorial space-y-5">
          <Reveal>
            <span className="eyebrow text-forest-700">{tr('Genesis', 'उद्गम')}</span>
          </Reveal>
          <Reveal delay={70}>
            <h2 className="text-[1.6rem] leading-snug text-ink-950 sm:text-[1.9rem]">
              {tr('The dispute was never about money. It was about evidence.', 'विवाद कभी पैसे का नहीं था। यह सबूत का था।')}
            </h2>
          </Reveal>
          <Reveal delay={130}>
            <p>
              {tr(
                'WurkUp was conceived during field inquiries at civil construction sites across Indore. Over',
                'WURK UP की कल्पना इंदौर के विभिन्न निर्माण स्थलों पर किए गए क्षेत्रीय सर्वेक्षणों के दौरान हुई। भारत के'
              )}{' '}
              <strong>{tr('85% of India’s construction workforce', '85% निर्माण श्रमबल')}</strong>{' '}
              {tr(
                'operates in the unorganised sector — vulnerable to delayed payments, arbitrary muster cuts and denial of overtime.',
                'असंगठित क्षेत्र में काम करता है — देर से भुगतान, मनमानी हाजिरी कटौती और ओवरटाइम से इंकार के जोखिम के साथ।'
              )}
            </p>
          </Reveal>
          <Reveal delay={190}>
            <p>
              {tr(
                'Contractor diaries and paper muster rolls are frequently withheld, lost or altered exactly when weekly settlements fall due. A worker has no independent, verifiable record to enforce rights under the',
                'ठेकेदार की डायरी और कागज़ी हाजिरी रजिस्टर ठीक उस समय रोके जाते हैं, खो जाते हैं या बदल दिए जाते हैं जब साप्ताहिक भुगतान देय होता है। श्रमिक के पास अधिकारों की रक्षा हेतु कोई स्वतंत्र, सत्यापन-योग्य रिकॉर्ड नहीं होता —'
              )}{' '}
              <strong>{tr('Madhya Pradesh Minimum Wages Act, 1948', 'मध्य प्रदेश न्यूनतम मजदूरी अधिनियम, 1948')}</strong>{' '}
              {tr(
                '— and a contractor has no defence against inflated claims either.',
                'और ठेकेदार के पास भी बढ़ा-चढ़ाकर किए गए दावों से बचाव का कोई आधार नहीं होता।'
              )}
            </p>
          </Reveal>
          <Reveal delay={250}>
            <p>
              {tr(
                'The 2.0 architecture replaces the contested page with a shared, signed timeline: a site requests a shift, the worker approves it on their own device, statute prices it, and a hash chain seals it. Neither party can rewrite it alone.',
                '2.0 आर्किटेक्चर विवादित पन्ने की जगह एक साझा, हस्ताक्षरित टाइमलाइन देता है: साइट शिफ्ट का अनुरोध करती है, श्रमिक अपने ही डिवाइस पर उसे स्वीकृत करता है, अधिनियम उसकी दर तय करता है, और हैश-चेन उसे सील कर देती है। कोई भी पक्ष अकेले उसे बदल नहीं सकता।'
              )}
            </p>
          </Reveal>
        </div>

        <Reveal direction="right" delay={120} className="space-y-4">
          <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
            <p className="font-display text-[2.5rem] font-semibold leading-none text-ink-950">
              <CountUp value={85} suffix="%" />
            </p>
            <p className="mt-2 text-[12px] font-bold text-ink-700">
              {tr('of India’s construction workforce is informal', 'भारत का निर्माण श्रमबल असंगठित है')}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-ink-400">
              {tr('No written wage record, no portable employment history.', 'न मजदूरी का लिखित रिकॉर्ड, न साथ चलने वाला रोजगार इतिहास।')}
            </p>
          </div>
          <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
            <p className="font-display text-[2.5rem] font-semibold leading-none text-ink-950">
              <CountUp value={4} />
            </p>
            <p className="mt-2 text-[12px] font-bold text-ink-700">
              {tr('statutory wage bands encoded', 'सांविधिक मजदूरी श्रेणियाँ एन्कोडेड')}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-ink-400">
              {tr('Unskilled to highly skilled, with pro-rata overtime.', 'अकुशल से उच्च कुशल तक, आनुपातिक ओवरटाइम सहित।')}
            </p>
          </div>
          <div className="rounded-2xl border border-forest-200 bg-forest-50/70 p-6">
            <Target className="h-5 w-5 text-forest-700" />
            <p className="mt-3 text-[12px] font-bold text-forest-900">{tr('One portable record', 'एक साथ चलने वाला रिकॉर्ड')}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-forest-800/80">
              {tr(
                'The same pass should eventually travel between sites, contractors and states — so a career can be proven, not just a month.',
                'यही पास आगे चलकर साइटों, ठेकेदारों और राज्यों के बीच काम आना चाहिए — ताकि सिर्फ़ एक महीना नहीं, पूरा करियर साबित हो सके।'
              )}
            </p>
          </div>
        </Reveal>
      </section>

      {/* Principles */}
      <section className="mt-20">
        <SectionHeading
          eyebrow={tr('Design principles', 'डिज़ाइन सिद्धांत')}
          title={tr('Four rules we refuse to trade away', 'चार नियम जिनसे हम समझौता नहीं करते')}
          description={tr('Every product decision is checked against these. If a feature breaks one, it does not ship.', 'हर उत्पाद निर्णय इन्हीं कसौटियों पर परखा जाता है। जो फ़ीचर इनमें से एक को भी तोड़ता है, वह जारी नहीं होता।')}
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title.en} delay={index * 80}>
                <div className="group flex h-full gap-4 rounded-2xl border border-sand-200 bg-white p-5 transition-all duration-500 hover:-translate-y-1 hover:border-forest-200 hover:shadow-lift">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-forest-50 to-sand-100 text-forest-700 ring-1 ring-inset ring-forest-100 transition-colors group-hover:from-forest-700 group-hover:to-forest-900 group-hover:text-white">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h3 className="text-[13px] font-bold text-ink-900">{tr(item.title.en, item.title.hi)}</h3>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{tr(item.body.en, item.body.hi)}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Compliance */}
      <section className="mt-20 overflow-hidden rounded-[1.75rem] border border-sand-200 bg-white">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-forest-800 via-forest-900 to-ink-950 p-8 text-white sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-grid-dark opacity-40" aria-hidden="true" />
            <div className="relative">
              <Scale className="h-6 w-6 text-brass-300" />
              <h2 className="mt-4 text-[1.4rem] leading-snug text-white">
                {tr('Statutory welfare alignment', 'सांविधिक कल्याण से जुड़ाव')}
              </h2>
              <p className="mt-3 text-[12px] leading-relaxed text-sand-200/65">
                {tr(
                  'The platform is designed to bridge workers into existing welfare programmes rather than replace them.',
                  'यह मंच श्रमिकों को मौजूदा कल्याण योजनाओं से जोड़ता है, उनकी जगह नहीं लेता।'
                )}
              </p>
              <div className="mt-6 space-y-2">
                {[
                  ['e-Shram NDUW', 'ई-श्रम एनडीयूडब्ल्यू'],
                  ['MP BOCW Welfare Board', 'एमपी बीओसीडब्ल्यू कल्याण बोर्ड'],
                  ['Direct Benefit Transfer', 'डायरेक्ट बेनिफ़िट ट्रांसफ़र'],
                ].map(([tag, tagHi]) => (
                  <div
                    key={tag}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-sand-200/80"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-brass-400" />
                    {tr(tag, tagHi)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <ul className="space-y-4">
              {[
                [
                  ['e-Shram National Database of Unorganised Workers', 'ई-श्रम असंगठित श्रमिकों का राष्ट्रीय डेटाबेस'],
                  [
                    'Connects worker UAN credentials to authentic employment muster histories instead of self-declared months.',
                    'श्रमिक के यूएएन को स्वयं घोषित महीनों के बजाय प्रामाणिक रोज़गार-हाजिरी इतिहास से जोड़ता है।',
                  ],
                ],
                [
                  ['MP BOCW Welfare Board', 'एमपी बीओसीडब्ल्यू कल्याण बोर्ड'],
                  [
                    'Generates tamper-evident 90-day attendance certificates required for accident insurance, maternity benefits and children’s education assistance.',
                    'दुर्घटना बीमा, मातृत्व लाभ और बच्चों की शिक्षा सहायता के लिए आवश्यक छेड़छाड़-रहित 90-दिनी उपस्थिति प्रमाणपत्र बनाता है।',
                  ],
                ],
                [
                  ['Direct Benefit Transfer', 'डायरेक्ट बेनिफ़िट ट्रांसफ़र'],
                  [
                    'Records bank accounts and UPI receipts so disbursements can be audited rather than asserted.',
                    'बैंक खाते और यूपीआई रसीदें दर्ज करता है ताकि भुगतान केवल दावे न रहें, जाँचे जा सकें।',
                  ],
                ],
              ].map(([[title, titleHi], [body, bodyHi]]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                  <span className="text-[11.5px] leading-relaxed text-ink-500">
                    <strong className="block text-[12px] font-bold text-ink-900">{tr(title, titleHi)}</strong>
                    {tr(body, bodyHi)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex items-start gap-2.5 rounded-xl border border-brass-200 bg-brass-50/70 p-3.5">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass-700" />
              <p className="text-[10.5px] leading-relaxed text-brass-900">
                {tr(
                  'An independent innovation project — not an official government portal. Registration with e-Shram and the BOCW board remains mandatory and separate.',
                  'यह एक स्वतंत्र नवाचार परियोजना है — कोई सरकारी पोर्टल नहीं। ई-श्रम और बीओसीडब्ल्यू बोर्ड में पंजीकरण अलग से अनिवार्य बना रहता है।'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <Reveal delay={80}>
        <section className="mt-14 flex flex-col items-center justify-between gap-5 rounded-2xl border border-sand-200 bg-sand-100/60 px-6 py-8 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-[1.2rem] leading-snug text-ink-950">
              {tr('Want to see the audit trail in person?', 'ऑडिट ट्रेल खुद देखना चाहते हैं?')}
            </h2>
            <p className="mt-1 text-[11.5px] text-ink-500">
              {tr('Judge demo mode loads a full Indore dataset with the cryptographic bench unlocked.', 'जज डेमो मोड पूरा इंदौर डेटासेट और खुला क्रिप्टोग्राफ़िक बेंच लोड करता है।')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button onClick={() => onNavigate('how-it-works')} className="btn btn-outline btn-sm">
              {tr('How it works', 'यह कैसे काम करता है')}
            </button>
            <button onClick={() => onNavigate('help')} className="btn btn-primary btn-sm">
              {tr('Contact the team', 'टीम से संपर्क करें')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </Reveal>
    </div>
  );
};
