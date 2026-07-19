// Inline-SVG payment badges — no external assets, CSP-safe. Shows only the
// methods the Stripe checkout actually accepts: cards + Apple Pay + Klarna.
// Each sits on a white tile so it reads clearly against the dark footer.

function Tile({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex h-7 w-11 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/5"
    >
      {children}
    </span>
  );
}

export function PaymentBadges({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <Tile label="Visa">
            <svg viewBox="0 0 48 16" className="h-3.5 w-auto">
              <text
                x="24"
                y="13"
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontSize="15"
                fontStyle="italic"
                fontWeight="700"
                fill="#1A1F71"
              >
                VISA
              </text>
            </svg>
          </Tile>
        </li>
        <li>
          <Tile label="Mastercard">
            <svg viewBox="0 0 32 20" className="h-4 w-auto">
              <circle cx="12" cy="10" r="8" fill="#EB001B" />
              <circle cx="20" cy="10" r="8" fill="#F79E1B" />
              <path d="M16 4a8 8 0 0 1 0 12 8 8 0 0 1 0-12Z" fill="#FF5F00" />
            </svg>
          </Tile>
        </li>
        <li>
          <Tile label="American Express">
            <svg viewBox="0 0 40 24" className="h-4 w-auto">
              <rect width="40" height="24" rx="3" fill="#2E77BC" />
              <text
                x="20"
                y="15"
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontSize="8"
                fontWeight="700"
                fill="#fff"
              >
                AMEX
              </text>
            </svg>
          </Tile>
        </li>
        <li>
          <Tile label="Apple Pay">
            <svg viewBox="0 0 48 20" className="h-auto w-9">
              {/* Minimal apple mark + wordmark, portable across platforms. */}
              <path
                d="M9.2 6.1c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 1.1-.4.5-.8 1.3-.7 2.1.8 0 1.6-.4 2-1Zm.7 1.1c-1.1-.1-2 .6-2.5.6-.5 0-1.3-.6-2.2-.6-1.1 0-2.2.7-2.7 1.7-1.2 2-.3 5 .8 6.6.5.8 1.2 1.7 2 1.6.8 0 1.1-.5 2.1-.5s1.3.5 2.1.5 1.4-.8 1.9-1.6c.6-.9.9-1.8.9-1.8s-1.6-.6-1.7-2.5c0-1.5 1.3-2.3 1.3-2.3s-.7-1.2-2.3-1.3Z"
                fill="#000"
              />
              <text
                x="15"
                y="14"
                fontFamily="-apple-system, Helvetica, Arial, sans-serif"
                fontSize="8"
                fontWeight="600"
                fill="#000"
              >
                Pay
              </text>
            </svg>
          </Tile>
        </li>
        <li>
          <Tile label="Klarna">
            <svg viewBox="0 0 44 20" className="h-full w-full">
              <rect width="44" height="20" rx="4" fill="#FFB3C7" />
              <text
                x="22"
                y="14"
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontSize="9"
                fontWeight="700"
                fill="#0A0A0A"
              >
                Klarna
              </text>
            </svg>
          </Tile>
        </li>
      </ul>
    </div>
  );
}
