# LeanPilot Landing Page Updater

Update or enhance the public landing page at `/landing`.

## Instructions

1. **Architecture**: The landing page lives at `frontend/src/app/landing/page.tsx` with 10 component files in `frontend/src/components/landing/`:
   - LandingNav, HeroSection, ProblemSection, FeaturesGrid, HowItWorks, SocialProof, PricingSection, CTASection, PrivacyModal, Footer

2. **i18n**: Landing page uses inline `translations` object (EN/IT) — NOT the app's `useI18n` store (landing is pre-auth)

3. **Design system**: Dark cinematic theme with:
   - Background: `bg-[#030712]` (near-black)
   - Gradients: `from-indigo-600 to-purple-600` (brand)
   - Text: `text-white` (headings), `text-gray-400/500` (body)
   - Cards: `bg-white/[0.03]` with `border-white/[0.06]`
   - Scroll animations via IntersectionObserver

4. **GDPR compliance**: Privacy modal must include Art. 13/14 disclosures. Cookie consent must be opt-in for analytics. ZZLP (Serbian) compliance required.

5. **Backend**: Signup endpoint at `POST /api/v1/auth/signup` using `LandingPageSignup` schema → creates factory + user + sends welcome email

$ARGUMENTS