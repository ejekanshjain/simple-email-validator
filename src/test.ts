import { validateEmail } from '.'

async function runTests() {
  const testEmails = [
    'ejekanshjain@gmail.com',
    'kljahdcsjkwnfvilkjwjikhfgjkh@gmail.com',
    'ekansh@ekansh.com',
    'ekansh.com',
    'ekansh@ekansh',
    'ekansh'
  ]

  for (const email of testEmails) {
    console.log(`Testing: ${email}`)
    const result = await validateEmail({
      email
    })
    console.log(result)
    console.log('-------------------------')
  }
}

runTests()
