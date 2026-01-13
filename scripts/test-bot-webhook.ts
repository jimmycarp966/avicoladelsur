import { URLSearchParams } from 'url'

async function postForm(url: string, form: Record<string, string>): Promise<{ status: number; body: string }> {
  const params = new URLSearchParams(form)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  return {
    status: res.status,
    body: await res.text(),
  }
}

async function main() {
  const baseUrl = process.env.BOT_TEST_URL || 'http://localhost:3000'
  const url = `${baseUrl}/api/bot`

  const from = process.env.BOT_TEST_FROM || 'whatsapp:+5491112345678'

  const messages = [
    'hola',
    'productos',
    'quiero 5 kg de ala',
    'quiero 2 kg de pechuga para mañana',
    'estado',
    'deuda',
  ]

  for (const Body of messages) {
    const resp = await postForm(url, {
      From: from,
      Body,
    })

    // Twilio responderá XML. Mostramos status + body recortado.
    const snippet = resp.body.length > 600 ? resp.body.slice(0, 600) + '…' : resp.body
    console.log('\n---')
    console.log('Body:', Body)
    console.log('Status:', resp.status)
    console.log('Response:', snippet)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
