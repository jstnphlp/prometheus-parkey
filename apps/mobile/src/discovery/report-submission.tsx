import type {
  ParkingContribution,
  ParkingReportReceipt,
} from '@parkey/shared-types'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, TextInput } from 'react-native'

import { config } from './config'
import { ModalSheet } from './sheets'
import { Button, Choice, ui } from './ui'
import {
  ReportAuthenticationError,
  reportForSending,
  requestReportCode,
  sendReportRequest,
  verifyReportCode,
} from './report-client'
import type { ReportSession } from './report-client'

const connection = { url: config.supabaseUrl, key: config.supabaseKey }
const enabled = process.env.EXPO_PUBLIC_REPORT_SUBMISSIONS_ENABLED === 'true'

export function ReportSubmission({
  draft,
  onClose,
  onReceipt,
  onAttempt,
}: {
  draft: ParkingContribution
  onClose: () => void
  onReceipt: (receipt: ParkingReportReceipt) => Promise<void>
  onAttempt: () => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeRequested, setCodeRequested] = useState(false)
  const [session, setSession] = useState<ReportSession | null>(null)
  const [name, setName] = useState(draft.name)
  const [date, setDate] = useState('')
  const [consent, setConsent] = useState(false)
  const [receipt, setReceipt] = useState(draft.submission)
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const pending = useRef<AbortController | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      pending.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!session) return
    const timer = setTimeout(
      () => {
        setSession(null)
        setCode('')
        setConsent(false)
        setMessage('Verification expired. Verify your email again.')
      },
      Math.max(0, session.expiresAt - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [session])
  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    if (pending.current || !enabled) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setMessage(null)
    try {
      await action(controller.signal)
    } catch (error) {
      if (alive.current && !controller.signal.aborted) {
        if (error instanceof ReportAuthenticationError) {
          setSession(null)
          setConsent(false)
        }
        setMessage(
          error instanceof Error
            ? error.message
            : 'Delivery could not be confirmed. Check sent status before retrying.',
        )
      }
    } finally {
      if (pending.current === controller) pending.current = null
      if (alive.current) setBusy(false)
    }
  }
  async function operation(
    action: 'submit' | 'status' | 'withdraw',
    signal: AbortSignal,
  ) {
    if (!session) return
    if (action === 'submit') {
      // Persist uncertainty before network I/O, so a lost receipt never claims local-only.
      if (!consent)
        throw new Error('Confirm that you want to send this report.')
      reportForSending(draft, name, date)
      await onAttempt()
      if (!alive.current || signal.aborted) return
    }
    const result = await sendReportRequest(
      connection,
      session,
      draft,
      action,
      signal,
      { name, observationDate: date, consent },
    )
    if (!alive.current || signal.aborted) return
    if (result.state === 'not_sent') {
      setMessage(
        'No sent report was found for this draft and verified account.',
      )
      return
    }
    setReceipt(result)
    try {
      await onReceipt(result)
    } catch {
      setMessage(
        'The server confirmed this report, but its receipt could not be saved locally. Check sent status to recover it.',
      )
    }
    setConsent(false)
    setConfirmWithdrawal(false)
  }
  return (
    <ModalSheet title="Report for review" onClose={onClose}>
      <ScrollView
        testID="report-submission"
        style={ui.sheetScroll}
        contentContainerStyle={{ padding: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={ui.title}>{draft.name.trim() || 'Parking report'}</Text>
        <Text style={ui.body}>
          A local copy stays on this device. Sending shares this report's text
          and selected map location with Parkey's private Moderation queue.
          Sending does not publish or verify parking.
        </Text>
        <Text style={ui.small}>
          Do not include personal names, phone numbers or number plates. Photo
          attachments stay on this device and are not sent.
        </Text>
        <Text style={ui.small}>
          Private report copies are removed after the 90-day retention window.
          Reviewed public facts and reviewer audit history are separate. You can
          withdraw a private report before publication.
        </Text>
        <Text style={ui.body}>
          {draft.restrictions.trim() ||
            'No correction or restrictions recorded.'}
        </Text>
        <Text style={ui.small}>
          Fees: {draft.fees.trim() || 'Unknown'}. Hours:{' '}
          {draft.hours.trim() || 'Unknown'}.
        </Text>
        {receipt ? (
          <Text accessibilityLiveRegion="polite" style={ui.heading}>
            {receipt.state === 'withdrawn'
              ? 'Sent report withdrawn'
              : 'Sent for private review'}
          </Text>
        ) : null}
        {!receipt && draft.submissionAttemptedAt ? (
          <Text accessibilityRole="alert" style={ui.body}>
            Delivery not confirmed. Verify the same email and check sent status
            before trying again.
          </Text>
        ) : null}
        {!enabled ? (
          <Text accessibilityRole="alert" style={ui.body}>
            Sending is not available in this build. Your report stays local. The
            verified-email submission service must be deployed and approved
            first.
          </Text>
        ) : (
          <>
            <Text style={ui.heading}>
              Verify email to send or manage a report
            </Text>
            <Text style={ui.small}>
              Parkey uses Supabase Auth to email a verification code.
              Credentials stay in memory and are cleared when this panel closes.
              Your email is not included in the report shown to reviewers.
            </Text>
            <TextInput
              accessibilityLabel="Report verification email"
              placeholder="Email address"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              maxLength={254}
              editable={!busy}
              style={ui.input}
              value={email}
              onChangeText={(value) => {
                setEmail(value)
                setSession(null)
                setCode('')
                setCodeRequested(false)
                setConsent(false)
                setConfirmWithdrawal(false)
              }}
            />
            {!session ? (
              <>
                <Button
                  disabled={busy || !email.trim()}
                  secondary
                  onPress={() =>
                    void perform(async (signal) => {
                      await requestReportCode(connection, email, signal)
                      if (alive.current && !signal.aborted) {
                        setCodeRequested(true)
                        setMessage(
                          'If email delivery is available, a verification code will arrive. Check your inbox.',
                        )
                      }
                    })
                  }
                >
                  Email verification code
                </Button>
                {codeRequested ? (
                  <>
                    <TextInput
                      accessibilityLabel="Email verification code"
                      placeholder="Verification code"
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      maxLength={8}
                      editable={!busy}
                      style={ui.input}
                      value={code}
                      onChangeText={setCode}
                    />
                    <Button
                      disabled={busy || !code.trim()}
                      onPress={() =>
                        void perform(async (signal) => {
                          const verified = await verifyReportCode(
                            connection,
                            email,
                            code,
                            signal,
                          )
                          if (alive.current && !signal.aborted) {
                            setSession(verified)
                            setCode('')
                            setMessage(
                              'Email verified for this panel. Review the report before sending.',
                            )
                          }
                        })
                      }
                    >
                      Verify email
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <Text style={ui.small}>Email verified for this panel.</Text>
                {!receipt ? (
                  <>
                    <TextInput
                      accessibilityLabel="Report parking name or description"
                      placeholder="Parking name or description"
                      value={name}
                      onChangeText={setName}
                      maxLength={100}
                      editable={!busy}
                      style={ui.input}
                    />
                    <TextInput
                      accessibilityLabel="Report observation date"
                      placeholder="Observed date: YYYY-MM-DD"
                      value={date}
                      onChangeText={setDate}
                      maxLength={10}
                      editable={!busy}
                      style={ui.input}
                    />
                    <Text style={ui.small}>
                      Use the actual date observed within the last 90 days.
                      Unknown fees or hours can stay unknown.
                    </Text>
                    <Choice
                      selected={consent}
                      onPress={() => {
                        if (!busy) setConsent((value) => !value)
                      }}
                    >
                      I agree to send this text report and its map location for
                      private review.
                    </Choice>
                    <Button
                      disabled={busy || !consent}
                      onPress={() =>
                        void perform((signal) => operation('submit', signal))
                      }
                    >
                      Send for review
                    </Button>
                  </>
                ) : null}
                <Button
                  disabled={busy}
                  secondary
                  onPress={() =>
                    void perform((signal) => operation('status', signal))
                  }
                >
                  Check sent status
                </Button>
                {receipt?.state === 'received' ? (
                  <>
                    <Text style={ui.small}>
                      Withdraw removes the private report if it has not been
                      published. Removing only the device copy does not withdraw
                      a sent report.
                    </Text>
                    <Button
                      disabled={busy}
                      secondary
                      onPress={() => {
                        if (!confirmWithdrawal) setConfirmWithdrawal(true)
                        else
                          void perform((signal) =>
                            operation('withdraw', signal),
                          )
                      }}
                    >
                      {confirmWithdrawal
                        ? 'Confirm withdrawal'
                        : 'Withdraw sent report'}
                    </Button>
                  </>
                ) : null}
                <Button
                  disabled={busy}
                  secondary
                  onPress={() => {
                    setSession(null)
                    setConsent(false)
                    setCode('')
                  }}
                >
                  Clear verification
                </Button>
              </>
            )}
            {busy ? (
              <Text accessibilityLiveRegion="polite" style={ui.small}>
                Contacting the service...
              </Text>
            ) : null}
          </>
        )}
        {message ? (
          <Text accessibilityRole="alert" style={ui.body}>
            {message}
          </Text>
        ) : null}
        <Button secondary onPress={onClose}>
          Back to local reports
        </Button>
      </ScrollView>
    </ModalSheet>
  )
}
