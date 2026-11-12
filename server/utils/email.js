
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Escape dynamic values before inserting them into HTML
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// 1. Booking Confirmation Email
const sendBookingEmail = async (userEmail, userName, eventTitle) => {
    try {
        const safeName = escapeHtml(userName || 'Customer');
        const safeTitle = escapeHtml(eventTitle || 'your event');

        const mailOptions = {
            from: `"Eventora" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: `Booking Confirmed: ${eventTitle}`,
            text: `Hi ${userName || 'Customer'}! Your booking for ${eventTitle} is confirmed. Thank you for choosing Eventora.`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin:0;padding:30px 12px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#344054;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0"
                                    style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">

                                    <tr>
                                        <td align="center" style="background:#175cd3;padding:28px 20px;color:#ffffff;">
                                            <div style="font-size:38px;">&#10003;</div>
                                            <h1 style="margin:10px 0;font-size:25px;">Booking Confirmed!</h1>
                                            <p style="margin:0;color:#e5edff;font-size:14px;">
                                                Your reservation is successful.
                                            </p>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:28px;">
                                            <h2 style="margin:0 0 14px;color:#101828;">Hi ${safeName}!</h2>

                                            <p style="font-size:15px;line-height:1.8;">
                                                Great news! Your booking for
                                                <strong>${safeTitle}</strong> has been confirmed.
                                            </p>

                                            <div style="margin:24px 0;padding:20px;text-align:center;background:#f2f6ff;border:1px solid #dbe7ff;border-radius:10px;">
                                                <p style="margin:0 0 8px;font-size:12px;color:#667085;">
                                                    YOUR EVENT
                                                </p>
                                                <h3 style="margin:0;color:#175cd3;font-size:20px;">
                                                    ${safeTitle}
                                                </h3>
                                            </div>

                                            <p style="font-size:14px;line-height:1.8;">
                                                Please keep this email for your reference.
                                                We look forward to seeing you at the event!
                                            </p>

                                            <p style="font-size:15px;line-height:1.8;">
                                                Best regards,<br>
                                                <strong>Eventora Team</strong>
                                            </p>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td align="center" style="padding:18px;background:#f9fafb;border-top:1px solid #eaecf0;">
                                            <p style="margin:0;font-size:12px;line-height:1.7;color:#98a2b3;">
                                                This is an automated email. Please do not reply.<br>
                                                &copy; ${new Date().getFullYear()} Eventora. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>

                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Booking email sent successfully to', userEmail);
        return true;

    } catch (error) {
        console.error('Error sending booking email:', error);
        return false;
    }
};

// 2. OTP Verification Email
const sendOTPEmail = async (userEmail, otp, type) => {
    try {
        const isAccountVerification = type === 'account_verification';

        const title = isAccountVerification
            ? 'Verify Your Eventora Account'
            : 'Eventora Booking Verification';

        const message = isAccountVerification
            ? 'Use this code to verify your email address and complete your account registration.'
            : 'Use this code to verify your email and continue with your event booking.';

        const mailOptions = {
            from: `"Eventora" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: title,
            text: `${title}\n\n${message}\n\nYour OTP is: ${otp}\n\nThis code expires in 5 minutes. Never share it with anyone.`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin:0;padding:30px 12px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#344054;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0"
                                    style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">

                                    <tr>
                                        <td align="center" style="background:#175cd3;padding:28px 20px;color:#ffffff;">
                                            <h1 style="margin:0;font-size:25px;">${title}</h1>
                                            <p style="margin:10px 0 0;color:#e5edff;font-size:14px;">
                                                Secure verification made simple
                                            </p>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:30px 26px;">
                                            <h2 style="margin:0 0 14px;color:#101828;">Hello!</h2>

                                            <p style="font-size:15px;line-height:1.8;">
                                                ${message}
                                            </p>

                                            <div style="margin:24px 0;padding:22px 12px;text-align:center;background:#f2f6ff;border:1px dashed #175cd3;border-radius:10px;">
                                                <p style="margin:0 0 12px;color:#667085;font-size:12px;letter-spacing:2px;">
                                                    YOUR VERIFICATION CODE
                                                </p>
                                                <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#175cd3;word-break:break-all;">
                                                    ${escapeHtml(otp)}
                                                </div>
                                            </div>

                                            <p style="font-size:14px;line-height:1.8;">
                                                &#9201; This code expires in <strong>5 minutes</strong>.
                                            </p>

                                            <p style="font-size:14px;line-height:1.8;">
                                                &#128274; Never share your OTP with anyone, including our support team.
                                            </p>

                                            <p style="font-size:14px;line-height:1.8;">
                                                If you didn't request this code, you can safely ignore this email.
                                            </p>

                                            <p style="font-size:15px;line-height:1.8;">
                                                Best regards,<br>
                                                <strong>Eventora Team</strong>
                                            </p>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td align="center" style="padding:18px;background:#f9fafb;border-top:1px solid #eaecf0;">
                                            <p style="margin:0;font-size:12px;line-height:1.7;color:#98a2b3;">
                                                This is an automated email. Please do not reply.<br>
                                                &copy; ${new Date().getFullYear()} Eventora. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>

                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${userEmail} for ${type}`);
        return true;

    } catch (error) {
        console.error('Error sending OTP email:', error);
        return false;
    }
};

module.exports = { sendBookingEmail, sendOTPEmail };
