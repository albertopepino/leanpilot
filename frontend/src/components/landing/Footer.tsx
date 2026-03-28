"use client";
import Logo from "@/components/ui/Logo";

interface Props {
  t: (key: string) => string;
  onShowPrivacy: () => void;
}

export default function Footer({ t, onShowPrivacy }: Props) {
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t("footer.product"),
      links: [
        { label: t("footer.features"), href: "#showcase" },
        { label: t("footer.pricing"), href: "#pricing" },
        { label: t("footer.demo"), href: "#demo" },
        { label: t("footer.changelog"), href: "#" },
      ],
    },
    {
      title: t("footer.solutions"),
      links: [
        { label: t("footer.manufacturing"), href: "#" },
        { label: t("footer.automotive"), href: "#" },
        { label: t("footer.food"), href: "#" },
        { label: t("footer.pharma"), href: "#" },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { label: t("footer.about"), href: "#" },
        { label: t("footer.contact"), href: "mailto:hello@leanpilot.app" },
        { label: t("footer.blog"), href: "#" },
        { label: t("footer.careers"), href: "#" },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { label: t("footer.privacy"), action: onShowPrivacy },
        { label: t("footer.terms"), action: onShowPrivacy },
        { label: t("footer.cookies"), action: onShowPrivacy },
        { label: t("footer.dpa"), action: onShowPrivacy },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-gray-200 bg-gray-50 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Logo size={18} />
              </div>
              <span className="font-bold text-base tracking-tight text-gray-900">
                Lean<span className="text-indigo-600">Pilot</span>
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4 max-w-[200px]">
              {t("footer.tagline")}
            </p>

            <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[11px] font-medium px-3 py-1.5 rounded-full">
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {t("footer.gdpr")}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"action" in link && link.action ? (
                      <button
                        onClick={link.action}
                        className="text-sm text-gray-500 hover:text-gray-900 transition"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={"href" in link ? link.href : "#"}
                        onClick={(e) => {
                          const href = "href" in link ? link.href : "";
                          if (href.startsWith("#")) {
                            e.preventDefault();
                            const id = href.slice(1);
                            if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                          }
                        }}
                        className="text-sm text-gray-500 hover:text-gray-900 transition"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            {t("footer.copy").replace("{year}", String(year))}
          </p>

          <div className="flex items-center gap-4">
            <a href="#" className="text-gray-400 hover:text-gray-600 transition" aria-label="LinkedIn">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-600 transition" aria-label="Twitter">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-600 transition" aria-label="GitHub">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
