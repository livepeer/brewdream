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
    <Preview>Your login code: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your Login Code</Heading>
        <Text style={text}>
          Enter this code to log in:
        </Text>
        <code style={code}>{token}</code>
        <Text style={{ ...text, marginTop: '32px', marginBottom: '8px' }}>
          Or click the link below:
        </Text>
        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={link}
        >
          Sign in with magic link
        </Link>
        <Text
          style={{
            ...text,
            color: '#ababab',
            marginTop: '32px',
            marginBottom: '16px',
          }}
        >
          If you didn&apos;t try to login, you can safely ignore this email.
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

const link = {
  color: '#8B5CF6',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  textDecoration: 'underline',
}

const text = {
  color: '#d1d5db',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  margin: '24px 0',
}

const code = {
  display: 'inline-block',
  padding: '16px 4.5%',
  width: '90.5%',
  backgroundColor: '#1a1a1a',
  borderRadius: '8px',
  border: '1px solid #333',
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  letterSpacing: '0.1em',
}
