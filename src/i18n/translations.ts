/**
 * Locale catalogue for the Sorokit UI (#1157).
 *
 * The keys here are intentionally limited to the strings rendered by the
 * wallet connection, settings, and transaction confirmation surfaces. Keeping
 * the catalogue small makes it reviewable: translators can see every string in
 * one place and a missing key is a compile error rather than a silent English
 * fallback in production.
 */

export const SUPPORTED_LOCALES = ["en", "es", "zh", "ja"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Key used to persist the chosen language between sessions. */
export const LOCALE_STORAGE_KEY = "sorokit_locale";

/** Endonyms, so a user can recognise their language in the selector. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  ja: "日本語",
};

export const TRANSLATION_KEYS = [
  "connect.title",
  "connect.subtitle",
  "connect.button",
  "connect.supportedWallets",
  "connect.mobileWallets",
  "connect.newToStellar",
  "connect.unlockWithBiometrics",
  "connect.biometricFailed",
  "connect.biometricFallback",
  "connecting",
  "settings.title",
  "settings.network",
  "settings.language",
  "settings.refreshBalances",
  "settings.disconnect",
  "settings.biometricUnlock",
  "settings.biometricError",
  "settings.biometricUnsupported",
  "wallet.connect",
  "wallet.connecting",
  "wallet.disconnect",
  "wallet.disconnecting",
  "wallet.manage",
  "tx.confirmTitle",
  "tx.cancel",
  "tx.confirmSign",
  "tx.signing",
  "tx.operations",
  "tx.feeBreakdown",
  "tx.details",
  "tx.baseFee",
  "tx.networkFee",
  "tx.total",
  "tx.sourceAccount",
  "tx.sequenceNumber",
  "tx.timeoutLedger",
  "tx.determinedByWallet",
  "tx.hardwareNotice",
  "tx.confirmOnDevice",
  "hardware.badge",
] as const;

export type TranslationKey = (typeof TRANSLATION_KEYS)[number];

export type Translations = Record<TranslationKey, string>;

export const translations: Record<Locale, Translations> = {
  en: {
    "connect.title": "Connect Wallet",
    "connect.subtitle":
      "Connect your Stellar wallet to access the dashboard and manage your assets.",
    "connect.button": "Connect Wallet",
    "connect.supportedWallets": "Supported wallets",
    "connect.mobileWallets": "Open in a mobile wallet app",
    "connect.newToStellar": "New to Stellar?",
    "connect.unlockWithBiometrics": "Unlock with biometrics",
    "connect.biometricFailed":
      "Biometric unlock was not verified. Connect your wallet instead.",
    "connect.biometricFallback": "Or continue with your wallet below.",
    connecting: "Connecting…",
    "settings.title": "Settings",
    "settings.network": "Network",
    "settings.language": "Language",
    "settings.refreshBalances": "Refresh balances",
    "settings.disconnect": "Disconnect",
    "settings.biometricUnlock": "Biometric unlock",
    "settings.biometricError":
      "Biometric unlock could not be enabled. Check your device settings and try again.",
    "settings.biometricUnsupported":
      "Biometric unlock is not available in this browser.",
    "wallet.connect": "Connect Wallet",
    "wallet.connecting": "Connecting…",
    "wallet.disconnect": "Disconnect",
    "wallet.disconnecting": "Disconnecting…",
    "wallet.manage": "Click to manage.",
    "tx.confirmTitle": "Confirm transaction",
    "tx.cancel": "Cancel",
    "tx.confirmSign": "Confirm & Sign",
    "tx.signing": "Signing…",
    "tx.operations": "Operations",
    "tx.feeBreakdown": "Fee breakdown",
    "tx.details": "Details",
    "tx.baseFee": "Base fee",
    "tx.networkFee": "Network fee",
    "tx.total": "Total",
    "tx.sourceAccount": "Source account",
    "tx.sequenceNumber": "Sequence number",
    "tx.timeoutLedger": "Timeout ledger",
    "tx.determinedByWallet": "Determined by wallet",
    "tx.hardwareNotice":
      "Hardware wallet: review every detail on your device before signing.",
    "tx.confirmOnDevice": "I reviewed the details on my hardware device",
    "hardware.badge": "Hardware",
  },
  es: {
    "connect.title": "Conectar billetera",
    "connect.subtitle":
      "Conecta tu billetera Stellar para acceder al panel y administrar tus activos.",
    "connect.button": "Conectar billetera",
    "connect.supportedWallets": "Billeteras compatibles",
    "connect.mobileWallets": "Abrir en una aplicación móvil",
    "connect.newToStellar": "¿Nuevo en Stellar?",
    "connect.unlockWithBiometrics": "Desbloquear con biometría",
    "connect.biometricFailed":
      "No se pudo verificar el desbloqueo biométrico. Conecta tu billetera.",
    "connect.biometricFallback": "O continúa con tu billetera más abajo.",
    connecting: "Conectando…",
    "settings.title": "Configuración",
    "settings.network": "Red",
    "settings.language": "Idioma",
    "settings.refreshBalances": "Actualizar saldos",
    "settings.disconnect": "Desconectar",
    "settings.biometricUnlock": "Desbloqueo biométrico",
    "settings.biometricError":
      "No se pudo activar el desbloqueo biométrico. Revisa la configuración del dispositivo e inténtalo de nuevo.",
    "settings.biometricUnsupported":
      "El desbloqueo biométrico no está disponible en este navegador.",
    "wallet.connect": "Conectar billetera",
    "wallet.connecting": "Conectando…",
    "wallet.disconnect": "Desconectar",
    "wallet.disconnecting": "Desconectando…",
    "wallet.manage": "Haz clic para administrar.",
    "tx.confirmTitle": "Confirmar transacción",
    "tx.cancel": "Cancelar",
    "tx.confirmSign": "Confirmar y firmar",
    "tx.signing": "Firmando…",
    "tx.operations": "Operaciones",
    "tx.feeBreakdown": "Detalle de comisiones",
    "tx.details": "Detalles",
    "tx.baseFee": "Comisión base",
    "tx.networkFee": "Comisión de red",
    "tx.total": "Total",
    "tx.sourceAccount": "Cuenta de origen",
    "tx.sequenceNumber": "Número de secuencia",
    "tx.timeoutLedger": "Libro de tiempo de espera",
    "tx.determinedByWallet": "Determinado por la billetera",
    "tx.hardwareNotice":
      "Billetera de hardware: revisa cada detalle en tu dispositivo antes de firmar.",
    "tx.confirmOnDevice": "Revisé los detalles en mi dispositivo de hardware",
    "hardware.badge": "Hardware",
  },
  zh: {
    "connect.title": "连接钱包",
    "connect.subtitle": "连接您的 Stellar 钱包以访问仪表板并管理您的资产。",
    "connect.button": "连接钱包",
    "connect.supportedWallets": "支持的钱包",
    "connect.mobileWallets": "在移动钱包应用中打开",
    "connect.newToStellar": "初次使用 Stellar？",
    "connect.unlockWithBiometrics": "使用生物识别解锁",
    "connect.biometricFailed": "生物识别验证失败。请改为连接钱包。",
    "connect.biometricFallback": "或使用下方钱包继续。",
    connecting: "正在连接…",
    "settings.title": "设置",
    "settings.network": "网络",
    "settings.language": "语言",
    "settings.refreshBalances": "刷新余额",
    "settings.disconnect": "断开连接",
    "settings.biometricUnlock": "生物识别解锁",
    "settings.biometricError": "无法启用生物识别解锁。请检查设备设置后重试。",
    "settings.biometricUnsupported": "此浏览器不支持生物识别解锁。",
    "wallet.connect": "连接钱包",
    "wallet.connecting": "正在连接…",
    "wallet.disconnect": "断开连接",
    "wallet.disconnecting": "正在断开连接…",
    "wallet.manage": "点击进行管理。",
    "tx.confirmTitle": "确认交易",
    "tx.cancel": "取消",
    "tx.confirmSign": "确认并签名",
    "tx.signing": "正在签名…",
    "tx.operations": "操作",
    "tx.feeBreakdown": "费用明细",
    "tx.details": "详情",
    "tx.baseFee": "基础费用",
    "tx.networkFee": "网络费用",
    "tx.total": "合计",
    "tx.sourceAccount": "源账户",
    "tx.sequenceNumber": "序列号",
    "tx.timeoutLedger": "超时账本",
    "tx.determinedByWallet": "由钱包决定",
    "tx.hardwareNotice": "硬件钱包：签名前请在设备上核对每一项详情。",
    "tx.confirmOnDevice": "我已在硬件设备上核对详情",
    "hardware.badge": "硬件",
  },
  ja: {
    "connect.title": "ウォレットを接続",
    "connect.subtitle":
      "Stellar ウォレットを接続して、ダッシュボードと資産管理にアクセスします。",
    "connect.button": "ウォレットを接続",
    "connect.supportedWallets": "対応ウォレット",
    "connect.mobileWallets": "モバイルウォレットアプリで開く",
    "connect.newToStellar": "Stellar は初めてですか？",
    "connect.unlockWithBiometrics": "生体認証でロック解除",
    "connect.biometricFailed":
      "生体認証を確認できませんでした。ウォレットを接続してください。",
    "connect.biometricFallback": "または下のウォレットで続けてください。",
    connecting: "接続中…",
    "settings.title": "設定",
    "settings.network": "ネットワーク",
    "settings.language": "言語",
    "settings.refreshBalances": "残高を更新",
    "settings.disconnect": "切断",
    "settings.biometricUnlock": "生体認証によるロック解除",
    "settings.biometricError":
      "生体認証を有効にできませんでした。デバイスの設定を確認して再度お試しください。",
    "settings.biometricUnsupported": "このブラウザでは生体認証を利用できません。",
    "wallet.connect": "ウォレットを接続",
    "wallet.connecting": "接続中…",
    "wallet.disconnect": "切断",
    "wallet.disconnecting": "切断中…",
    "wallet.manage": "クリックして管理します。",
    "tx.confirmTitle": "トランザクションの確認",
    "tx.cancel": "キャンセル",
    "tx.confirmSign": "確認して署名",
    "tx.signing": "署名中…",
    "tx.operations": "操作",
    "tx.feeBreakdown": "手数料の内訳",
    "tx.details": "詳細",
    "tx.baseFee": "基本手数料",
    "tx.networkFee": "ネットワーク手数料",
    "tx.total": "合計",
    "tx.sourceAccount": "送信元アカウント",
    "tx.sequenceNumber": "シーケンス番号",
    "tx.timeoutLedger": "タイムアウトレッジャー",
    "tx.determinedByWallet": "ウォレットが決定",
    "tx.hardwareNotice":
      "ハードウェアウォレット: 署名前にデバイスで詳細を必ず確認してください。",
    "tx.confirmOnDevice": "ハードウェアデバイスで詳細を確認しました",
    "hardware.badge": "ハードウェア",
  },
};

/** Runtime guard for values read from localStorage or other untrusted input. */
export function isLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
