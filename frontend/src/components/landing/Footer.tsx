"use client";
import Logo from "@/components/ui/Logo";

interface Props {
  t: (key: string) => string;
  onShowPrivacy: () => void;
}

export default function Footer({ t, onShowPrivacy }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/5 bg-[#030712]">
      {/* Subtle gradient top edge */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                <Logo size={20} />
              </div>
              <span className="text-white font-bold text-lg">LeanPilot</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              {t("footer.tagline")}
            </p>
            {/* GDPR badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-green-400 text-xs font-medium">{t("footer.gdpr")}</span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              {t("footer.product")}
            </h4>
            <ul className="space-y-3">
              <li>
                <a href="#features" className="text-gray-500 hover:text-gray-300 transition text-sm">
                  {t("nav.features")}
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-gray-500 hover:text-gray-300 transition text-sm">
                  {t("nav.pricing")}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              {t("footer.legal")}
            </h4>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={onShowPrivacy}
                  className="text-gray-500 hover:text-gray-300 transition text-sm text-left"
                >
                  {t("footer.privacy")}
                </button>
              </li>
              <li>
                <a href="#" className="text-gray-500 hover:text-gray-300 transition text-sm">
                  {t("footer.terms")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-500 hover:text-gray-300 transition text-sm">
                  {t("footer.cookies")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-500 hover:text-gray-300 transition text-sm">
                  {t("footer.dpa")}
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              {t("footer.company")}
            </h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-gray-500 hover:text-gray-300 transition text-sm">
                  {t("footer.about")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-500 hover:text-gray-300 transition text-sm">
                  {t("footer.contact")}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-500 hover:text-gray-300 transition text-sm">
                  {t("footer.blog")}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">
            {t("footer.copy").replace("{year}", String(year))}
          </p>
          <div className="flex items-center gap-6">
            {/* Social icons */}
            <a href="#" className="text-gray-600 hover:text-gray-400 transition" aria-label="LinkedIn">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition" aria-label="Twitter">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
