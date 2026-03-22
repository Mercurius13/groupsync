import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendProjectInvite({
  toEmail,
  inviterName,
  projectTitle,
  appUrl,
  inviteToken,
}: {
  toEmail: string
  inviterName: string
  projectTitle: string
  appUrl: string
  inviteToken: string
}) {
  const signupUrl = `${appUrl}/signup?token=${inviteToken}`

  await resend.emails.send({
    from: 'GroupSync <onboarding@resend.dev>',
    to: toEmail,
    subject: `${inviterName} invited you to join "${projectTitle}" on GroupSync`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #4f46e5; margin-bottom: 8px;">You've been invited to GroupSync</h2>
        <p style="color: #374151; font-size: 16px;">
          <strong>${inviterName}</strong> has invited you to collaborate on the project
          <strong>"${projectTitle}"</strong>.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          GroupSync is an academic group project management platform that tracks contributions
          and helps ensure fair grading.
        </p>
        <a
          href="${signupUrl}"
          style="
            display: inline-block;
            margin-top: 24px;
            padding: 12px 24px;
            background-color: #4f46e5;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
          "
        >
          Create your account
        </a>
        <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">
          Sign up with this email address (${toEmail}) and you'll be added to the project automatically.
        </p>
      </div>
    `,
  })
}
