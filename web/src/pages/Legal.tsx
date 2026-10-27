import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { Logo } from '../components/Logo';
import { EFFECTIVE, PRIVACY, TERMS, type Lang } from '../lib/legal';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('legal-lang');
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    /* bỏ qua */
  }
  return navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const doc = (kind === 'privacy' ? PRIVACY : TERMS)[lang];

  useEffect(() => {
    document.title = `${doc.title} | Chéo`;
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('legal-lang', lang);
    } catch {
      /* bỏ qua */
    }
    return () => {
      document.documentElement.lang = 'vi';
    };
  }, [doc.title, lang]);

  return (
    <div className="landing legal-page">
      <header className="landing__bar">
        <Link to="/" aria-label="Chéo, về trang chủ" className="legal-page__home">
          <Logo size={26} />
        </Link>
        <div className="lang-switch" role="group" aria-label="Ngôn ngữ / Language">
          <button aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>Tiếng Việt</button>
          <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
        </div>
      </header>

      <article className="legal">
        <h1>{doc.title}</h1>
        <p className="legal__intro">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((t) => <p key={t}>{t}</p>)}
            {s.li && (
              <ul>
                {s.li.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
          </section>
        ))}
        <p className="legal__date">
          {lang === 'vi' ? 'Có hiệu lực từ ' : 'Effective '}
          {EFFECTIVE[lang]}
        </p>
      </article>

      <Footer />
    </div>
  );
}
