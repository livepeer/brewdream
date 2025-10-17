import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22'
import * as React from 'https://esm.sh/react@18.3.1'

interface OtpEmailProps {
  token: string
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
}

export const OtpEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: OtpEmailProps) => (
  <Html>
    <Head />
    <Preview>Your Brewdream login code: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your Login Code</Heading>
        <Text style={text}>
          Enter this 6-digit code to sign in to Brewdream:
        </Text>
        <div style={codeContainer}>
          <Text style={code}>{token}</Text>
        </div>
        <Text style={{ ...text, marginTop: '24px', color: '#ababab', fontSize: '12px' }}>
          This code will expire in 1 hour. If you didn&apos;t request this email, you can safely ignore it.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default OtpEmail

const main = {
  backgroundColor: '#0a0a0a',
}

const container = {
  paddingLeft: '12px',
  paddingRight: '12px',
  margin: '0 auto',
  paddingTop: '40px',
  paddingBottom: '40px',
}

const h1 = {
  color: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
}

const text = {
  color: '#d1d5db',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  margin: '24px 0',
}

const codeContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
}

const code = {
  display: 'inline-block',
  padding: '20px 40px',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  fontFamily:
    "'Courier New', monospace",
  fontSize: '32px',
  fontWeight: 'bold',
  letterSpacing: '8px',
  borderRadius: '12px',
  border: '2px solid #8B5CF6',
  margin: '0',
}
