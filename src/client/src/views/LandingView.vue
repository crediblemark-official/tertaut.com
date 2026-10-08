<script setup lang="ts">
import { computed } from "vue";
import { authClient } from "../lib/auth";
import { useSeo } from "../composables/useSeo";
import { STATIC_PAGES_META, createJsonLd } from "../constants/seo";
import PublicHeader from "../components/common/PublicHeader.vue";
import PublicFooter from "../components/common/PublicFooter.vue";
import LandingHero from "../components/landing/LandingHero.vue";
import LandingTrustBar from "../components/landing/LandingTrustBar.vue";
import LandingComparison from "../components/landing/LandingComparison.vue";
import LandingSolutions from "../components/landing/LandingSolutions.vue";
import LandingCodeShowcase from "../components/landing/LandingCodeShowcase.vue";
import LandingPricing from "../components/landing/LandingPricing.vue";
import LandingCalculator from "../components/landing/LandingCalculator.vue";
import LandingFaq from "../components/landing/LandingFaq.vue";
import LandingCta from "../components/landing/LandingCta.vue";

useSeo(STATIC_PAGES_META.home, [
  createJsonLd("organization"),
  createJsonLd("website"),
  createJsonLd("software"),
  createJsonLd("faq"),
]);

const authSession = authClient.useSession();
const isAdmin = computed(() => {
  const role = (authSession.value?.data?.user as { role?: string })?.role;
  return role === "admin";
});
</script>

<template>
  <div
    class="min-h-screen bg-white text-jetblack flex flex-col selection:bg-gold/20 selection:text-jetblack"
  >
    <!-- Public Reusable Header -->
    <PublicHeader />

    <!-- Hero Section with Interactive Demo Tabs -->
    <LandingHero />

    <!-- Trust Metrics Bar -->
    <LandingTrustBar />

    <!-- Problem vs Solution: Merchant of Record comparison -->
    <LandingComparison />

    <!-- 4 Core Product Pillars -->
    <LandingSolutions />

    <!-- Developer SDK Code Showcase -->
    <LandingCodeShowcase />

    <!-- Transparent Pricing & MoR Overview -->
    <LandingPricing />

    <!-- Revenue & Payout Calculator -->
    <LandingCalculator />

    <!-- FAQ Accordion -->
    <LandingFaq />

    <!-- Final High-Impact CTA Banner -->
    <LandingCta />

    <!-- Public Reusable Footer -->
    <PublicFooter :is-admin="isAdmin" />
  </div>
</template>
