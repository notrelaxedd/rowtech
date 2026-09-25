import type { Metadata } from "next";
import { SitePage, wrap } from "@/components/site/site-page";
import { inlineLink } from "@/components/site/legal";
import { SpecTable } from "@/components/site/spec-table";
import { pageMetadata } from "@/lib/site";
import packages from "@/lib/licenses.json";

// Third-party notices (LEG-014). lib/licenses.json and public/licenses.txt
// are written by scripts/licenses.mjs (npm run licenses); CI checks they
// match package-lock.json.
export const metadata: Metadata = pageMetadata({
  title: "Open-source licenses",
  description: "The open-source packages the RowTech site and dashboard use, and their licenses.",
  path: "/licenses",
});

export default function LicensesPage() {
  return (
    <SitePage>
      <div className={wrap}>
        <div className="max-w-3xl pt-20 pb-24 sm:pt-28 sm:pb-28">
          <h1 className="type-h1">Open-source licenses.</h1>
          <p className="type-lead mt-6 text-muted-foreground">
            The RowTech site and dashboard use the {packages.length} open-source packages below, in the code they run
            and in their stylesheet.
          </p>
          <p className="type-body mt-4 text-muted-foreground">
            Their license texts and copyright notices, as each package ships them, are in{" "}
            <a href="/licenses.txt" className={inlineLink}>
              one plain-text file
            </a>
            .
          </p>
          <p className="type-body mt-4 text-muted-foreground">
            Tools that only build and test the site aren’t listed, and neither are the machine-specific builds of
            Next.js’s compiler and sharp’s image library.
          </p>

          <div className="mt-14">
            <SpecTable specs={packages.map((p) => [`${p.name} ${p.version}`, p.license ?? "See its license file"] as const)} />
          </div>
        </div>
      </div>
    </SitePage>
  );
}
