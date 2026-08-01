from pathlib import Path

cart_path = Path("app/cart/page.tsx")
cart = cart_path.read_text(encoding="utf-8")

old = 'href="/login?next=/cart"'
new = 'href="/checkout"'

if old not in cart and new not in cart:
    raise SystemExit(
        "Could not find the checkout link in app/cart/page.tsx"
    )

cart = cart.replace(old, new)
cart_path.write_text(cart, encoding="utf-8")

login_path = Path("app/login/page.tsx")
login = login_path.read_text(encoding="utf-8")

login = login.replace(
    'import { FormEvent, useState } from "react";',
    'import { FormEvent, useEffect, useState } from "react";'
)

marker = '  const [error, setError] = useState("");\n'
block = '''  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function redirectLoggedInBuyer() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const next =
        new URLSearchParams(window.location.search).get("next") ||
        "/account";

      router.replace(next);
      router.refresh();
    }

    void redirectLoggedInBuyer();
  }, [router]);
'''

if "redirectLoggedInBuyer" not in login:
    if marker not in login:
        raise SystemExit(
            "Could not find the login state section in app/login/page.tsx"
        )
    login = login.replace(marker, block)

login_path.write_text(login, encoding="utf-8")

print("Updated cart checkout link and login redirect.")
