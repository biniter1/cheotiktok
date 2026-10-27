/**
 * Nội dung Privacy Policy và Terms of Service (tiếng Việt + tiếng Anh).
 * Mọi câu ở đây phải khớp với những gì code thực sự làm. Sửa code thì sửa cả file này.
 */

export const OPERATOR = {
  name: 'Hà Sơn Bin',
  nameEn: 'Ha Son Bin',
  email: 'hasonbin123@gmail.com',
  country: 'Việt Nam',
  countryEn: 'Vietnam',
};

export const EFFECTIVE = { vi: '27/10/2026', en: 'October 27, 2026' };

export type Lang = 'vi' | 'en';
export interface Section {
  h: string;
  p?: string[];
  li?: string[];
}
export interface Doc {
  title: string;
  intro: string;
  sections: Section[];
}

const contactVi = `Email: ${OPERATOR.email}. Chéo phản hồi mọi yêu cầu trong tối đa 30 ngày.`;
const contactEn = `Email: ${OPERATOR.email}. We respond to every request within 30 days.`;

export const PRIVACY: Record<Lang, Doc> = {
  vi: {
    title: 'Chính sách quyền riêng tư',
    intro: `Chéo là dịch vụ giúp người dùng TikTok kết nối và follow lẫn nhau, do ${OPERATOR.name} (${OPERATOR.country}) vận hành. Chính sách này nói rõ Chéo thu thập dữ liệu gì, dùng vào việc gì, giữ bao lâu và bạn có quyền gì.`,
    sections: [
      {
        h: 'Dữ liệu Chéo nhận từ TikTok',
        p: ['Khi bạn đăng nhập bằng TikTok và đồng ý cấp quyền, Chéo nhận:'],
        li: [
          'Mã định danh tài khoản của bạn trong Chéo (open_id), tên hiển thị và ảnh đại diện (quyền user.info.basic).',
          'Tên người dùng (username) và đường dẫn trang cá nhân TikTok (quyền user.info.profile).',
          'Số người theo dõi bạn (follower) và số người bạn đang theo dõi (following) (quyền user.info.stats).',
          'Mã truy cập (access token, refresh token) để đọc lại các thông tin trên. Mã này được mã hoá AES-256-GCM trước khi lưu.',
        ],
      },
      {
        h: 'Dữ liệu Chéo KHÔNG thu thập',
        li: [
          'Danh sách người follow bạn hoặc người bạn follow.',
          'Video, bình luận, tin nhắn, lượt thích của bạn.',
          'Email, số điện thoại, mật khẩu TikTok.',
          'Chéo không đăng bài, không follow, không thao tác thay bạn trên TikTok.',
        ],
      },
      {
        h: 'Dữ liệu phát sinh khi bạn dùng Chéo',
        li: [
          'Lịch sử ghép cặp, kết quả xác minh follow, quan hệ follow đã được xác minh.',
          'Điểm tin cậy và từng lần cộng, trừ điểm.',
          'Cảnh báo bỏ follow, xác nhận, báo cáo và kháng cáo bạn gửi hoặc liên quan tới bạn.',
          'Cookie đăng nhập (httpOnly) để giữ phiên. Chéo không dùng cookie quảng cáo hay công cụ theo dõi bên thứ ba.',
          'Nhật ký máy chủ có địa chỉ IP, dùng để chống lạm dụng và xử lý lỗi.',
        ],
      },
      {
        h: 'Chéo dùng dữ liệu để làm gì',
        li: [
          'Ghép bạn với người dùng khác đang trực tuyến.',
          'So sánh số following trước và sau lượt ghép để xác minh hai bên đã follow nhau.',
          'Kiểm tra số follower định kỳ (khoảng 15 phút một lần) để phát hiện khi bạn bị bỏ follow, và tìm người có khả năng đã bỏ follow trong số những người từng chéo với bạn.',
          'Tính điểm tin cậy, cảnh báo và xử phạt người gian lận.',
        ],
      },
      {
        h: 'Ai nhìn thấy thông tin của bạn',
        li: [
          'Người được ghép với bạn, và người có thể đã bị bạn bỏ follow, thấy: tên hiển thị, username, ảnh đại diện, link TikTok, điểm tin cậy, nhóm điểm và nhãn cảnh báo (nếu có).',
          'Số follower và following của bạn chỉ hiển thị cho chính bạn.',
          'Chéo không bán, không cho thuê dữ liệu, không chia sẻ cho bên quảng cáo.',
          'Dữ liệu được lưu trên máy chủ thuê của Microsoft Azure. Chéo chỉ cung cấp dữ liệu cho cơ quan nhà nước khi pháp luật yêu cầu.',
        ],
      },
      {
        h: 'Thời gian lưu trữ',
        li: [
          'Số liệu follower và following: tự động xoá sau 90 ngày.',
          'Tài khoản và lịch sử ghép cặp: giữ cho tới khi bạn xoá tài khoản.',
          'Bản sao lưu cơ sở dữ liệu: giữ 7 ngày rồi tự xoá.',
        ],
      },
      {
        h: 'Xoá tài khoản và dữ liệu',
        p: [
          'Bạn tự xoá tài khoản bất cứ lúc nào ở trang Điểm tin cậy, mục "Xoá tài khoản". Chéo xoá ngay mã truy cập TikTok, toàn bộ số liệu follower, tên, ảnh và username của bạn.',
          'Để lịch sử của người khác không bị sai lệch, Chéo giữ lại các lượt ghép đã ẩn danh. Chéo cũng giữ một mã băm không thể đảo ngược của mã định danh TikTok cùng điểm tin cậy lúc xoá, chỉ để ngăn việc xoá rồi tạo lại tài khoản nhằm xoá điểm xấu.',
          'Bạn cũng có thể thu hồi quyền của Chéo trong ứng dụng TikTok: Cài đặt và quyền riêng tư, mục quyền ứng dụng. Khi đó Chéo không đọc được số liệu của bạn nữa.',
        ],
      },
      {
        h: 'Quyền của bạn',
        p: [
          'Theo quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân, bạn có quyền được biết, truy cập, chỉnh sửa, yêu cầu xoá dữ liệu, rút lại sự đồng ý và khiếu nại. Gửi yêu cầu qua email bên dưới.',
        ],
      },
      {
        h: 'Bảo mật',
        li: [
          'Kết nối luôn dùng HTTPS.',
          'Mã truy cập TikTok được mã hoá trước khi lưu; khoá mã hoá tách riêng khỏi cơ sở dữ liệu.',
          'Chỉ người vận hành có quyền truy cập máy chủ.',
        ],
      },
      { h: 'Độ tuổi', p: ['Chéo dành cho người từ 13 tuổi trở lên và đủ điều kiện dùng TikTok theo điều khoản của TikTok.'] },
      { h: 'Thay đổi chính sách', p: ['Khi chính sách thay đổi, Chéo cập nhật trang này và ngày hiệu lực bên dưới. Thay đổi quan trọng sẽ được báo trong ứng dụng.'] },
      { h: 'Liên hệ', p: [`Người vận hành: ${OPERATOR.name}, ${OPERATOR.country}.`, contactVi] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    intro: `Chéo is a service that helps TikTok users connect with and follow each other. It is operated by ${OPERATOR.nameEn} (${OPERATOR.countryEn}). This policy explains what data Chéo collects, why, how long it is kept, and your rights.`,
    sections: [
      {
        h: 'Data we receive from TikTok',
        p: ['When you log in with TikTok and grant permission, Chéo receives:'],
        li: [
          'Your app-specific account identifier (open_id), display name and avatar (scope user.info.basic).',
          'Your username and TikTok profile link (scope user.info.profile).',
          'Your follower count and following count (scope user.info.stats).',
          'Access and refresh tokens used to re-read the data above. Tokens are encrypted with AES-256-GCM before storage.',
        ],
      },
      {
        h: 'Data we do NOT collect',
        li: [
          'Your list of followers or the list of accounts you follow.',
          'Your videos, comments, messages or likes.',
          'Your email, phone number or TikTok password.',
          'Chéo never posts, follows or takes any action on TikTok on your behalf.',
        ],
      },
      {
        h: 'Data created when you use Chéo',
        li: [
          'Match history, follow-back verification results and verified follow relationships.',
          'Your trust score and every change to it.',
          'Unfollow alerts, confirmations, reports and appeals you send or that concern you.',
          'A login cookie (httpOnly) to keep your session. No advertising cookies or third-party trackers.',
          'Server logs containing IP addresses, used to prevent abuse and fix errors.',
        ],
      },
      {
        h: 'How we use data',
        li: [
          'To match you with other users who are online.',
          'To compare your following count before and after a match, verifying that both people followed each other.',
          'To check your follower count periodically (about every 15 minutes), detect when you lose followers, and identify which users you matched with most likely unfollowed you.',
          'To calculate trust scores, show warnings and sanction users who cheat.',
        ],
      },
      {
        h: 'Who can see your information',
        li: [
          'Users matched with you, and users you may have unfollowed, can see your display name, username, avatar, TikTok link, trust score, score group and warning label (if any).',
          'Your follower and following counts are shown only to you.',
          'Chéo does not sell or rent data and does not share it with advertisers.',
          'Data is stored on servers rented from Microsoft Azure. Chéo discloses data to authorities only when required by law.',
        ],
      },
      {
        h: 'Retention',
        li: [
          'Follower and following counts: automatically deleted after 90 days.',
          'Account and match history: kept until you delete your account.',
          'Database backups: kept for 7 days, then deleted.',
        ],
      },
      {
        h: 'Deleting your account and data',
        p: [
          'You can delete your account at any time on the Trust score page under "Delete account". Chéo immediately deletes your TikTok tokens, all follower statistics, and your name, avatar and username.',
          'To keep other users’ history accurate, anonymized match records are retained. Chéo also keeps a one-way hash of your TikTok identifier together with your trust score at deletion, solely to prevent deleting and re-creating an account to erase a bad score.',
          'You can also revoke Chéo’s access in the TikTok app under Settings and privacy, app permissions. Chéo will then no longer be able to read your data.',
        ],
      },
      {
        h: 'Your rights',
        p: [
          'Under Vietnamese personal data protection law you have the right to be informed, to access, correct and delete your data, to withdraw consent, and to complain. Send requests to the email below.',
        ],
      },
      {
        h: 'Security',
        li: [
          'All connections use HTTPS.',
          'TikTok tokens are encrypted before storage, with the encryption key kept separately from the database.',
          'Only the operator can access the servers.',
        ],
      },
      { h: 'Age', p: ['Chéo is for people aged 13 or older who are eligible to use TikTok under TikTok’s terms.'] },
      { h: 'Changes', p: ['When this policy changes, we update this page and the effective date below. Significant changes are announced in the app.'] },
      { h: 'Contact', p: [`Operator: ${OPERATOR.nameEn}, ${OPERATOR.countryEn}.`, contactEn] },
    ],
  },
};

export const TERMS: Record<Lang, Doc> = {
  vi: {
    title: 'Điều khoản sử dụng',
    intro: `Khi dùng Chéo, bạn đồng ý với các điều khoản dưới đây. Chéo do ${OPERATOR.name} (${OPERATOR.country}) vận hành và miễn phí.`,
    sections: [
      {
        h: 'Chéo là gì',
        p: [
          'Chéo ghép bạn với người dùng TikTok khác đang trực tuyến để hai bên follow nhau, kiểm tra việc follow lại và theo dõi việc bỏ follow về sau.',
          'Chéo là dịch vụ độc lập, không thuộc, không được tài trợ hay xác nhận bởi TikTok hoặc ByteDance.',
        ],
      },
      {
        h: 'Tài khoản',
        li: [
          'Bạn đăng nhập bằng tài khoản TikTok của chính mình. Mỗi người chỉ dùng một tài khoản Chéo.',
          'Bạn chịu trách nhiệm về hoạt động trên tài khoản của mình.',
        ],
      },
      {
        h: 'Quy tắc khi dùng Chéo',
        li: [
          'Chỉ bấm "Mình đã follow" khi bạn đã follow thật.',
          'Không bỏ follow những người đã chéo với bạn.',
          'Không xác nhận sai rằng người khác bỏ follow bạn.',
          'Không dùng bot, công cụ tự động hay nhiều tài khoản để gian lận.',
          'Không quấy rối, lừa đảo người dùng khác.',
        ],
      },
      {
        h: 'Điểm tin cậy và xử phạt',
        p: [
          'Mỗi tài khoản có điểm tin cậy từ 0 đến 100, bắt đầu ở 50. Luật cộng, trừ điểm được công khai ở trang Điểm tin cậy.',
          'Điểm dưới 30: hiện nhãn cảnh báo với người được ghép. Dưới 10: khoá tạm 7 ngày. Bị xác nhận bỏ follow 5 lần: cấm vĩnh viễn.',
          'Hệ thống xác minh dựa trên số liệu tổng do TikTok cung cấp nên có thể sai. Nếu bị phạt oan, bạn gửi kháng cáo; Chéo xem xét và hoàn điểm nếu kháng cáo đúng.',
        ],
      },
      {
        h: 'Quy định của TikTok',
        p: [
          'Bạn vẫn phải tuân thủ Điều khoản dịch vụ và Nguyên tắc cộng đồng của TikTok. TikTok có thể hạn chế tài khoản có hoạt động mà TikTok coi là tương tác không tự nhiên. Bạn tự cân nhắc và chịu rủi ro này khi dùng Chéo.',
        ],
      },
      {
        h: 'Giới hạn trách nhiệm',
        li: [
          'Chéo được cung cấp "như hiện có", không cam kết hoạt động liên tục hay không có lỗi.',
          'Chéo không đảm bảo số follower của bạn tăng, và không chịu trách nhiệm về hành động của người dùng khác hoặc quyết định của TikTok đối với tài khoản của bạn.',
        ],
      },
      {
        h: 'Chấm dứt',
        p: [
          'Bạn có thể ngừng dùng và xoá tài khoản bất cứ lúc nào. Chéo có thể khoá tài khoản vi phạm các điều khoản này.',
        ],
      },
      {
        h: 'Luật áp dụng',
        p: ['Các điều khoản này tuân theo pháp luật Việt Nam. Điều khoản có thể được cập nhật; ngày hiệu lực ghi ở cuối trang.'],
      },
      { h: 'Liên hệ', p: [contactVi] },
    ],
  },
  en: {
    title: 'Terms of Service',
    intro: `By using Chéo you agree to these terms. Chéo is operated by ${OPERATOR.nameEn} (${OPERATOR.countryEn}) and is free to use.`,
    sections: [
      {
        h: 'What Chéo is',
        p: [
          'Chéo matches you with other TikTok users who are online so you can follow each other, verifies follow-backs, and tracks unfollows afterwards.',
          'Chéo is an independent service and is not affiliated with, sponsored or endorsed by TikTok or ByteDance.',
        ],
      },
      {
        h: 'Accounts',
        li: [
          'You log in with your own TikTok account. Each person may use only one Chéo account.',
          'You are responsible for activity on your account.',
        ],
      },
      {
        h: 'Rules',
        li: [
          'Only press "I followed" after you have actually followed.',
          'Do not unfollow people you matched with.',
          'Do not falsely confirm that someone unfollowed you.',
          'Do not use bots, automation or multiple accounts to cheat.',
          'Do not harass or scam other users.',
        ],
      },
      {
        h: 'Trust score and sanctions',
        p: [
          'Every account has a trust score from 0 to 100, starting at 50. The scoring rules are published on the Trust score page.',
          'Below 30: a warning label is shown to people you are matched with. Below 10: a 7-day suspension. Five confirmed unfollows: permanent ban.',
          'Verification relies on aggregate counts provided by TikTok and can be wrong. If you are penalized unfairly you can appeal; Chéo reviews appeals and restores points when an appeal is upheld.',
        ],
      },
      {
        h: 'TikTok’s rules',
        p: [
          'You must still follow TikTok’s Terms of Service and Community Guidelines. TikTok may restrict accounts for activity it considers inauthentic engagement. You decide whether to accept that risk when using Chéo.',
        ],
      },
      {
        h: 'Limitation of liability',
        li: [
          'Chéo is provided "as is" without any guarantee of uninterrupted or error-free operation.',
          'Chéo does not guarantee follower growth and is not responsible for other users’ actions or for TikTok’s decisions about your account.',
        ],
      },
      {
        h: 'Termination',
        p: ['You can stop using Chéo and delete your account at any time. Chéo may suspend accounts that violate these terms.'],
      },
      {
        h: 'Governing law',
        p: ['These terms are governed by the laws of Vietnam. They may be updated; the effective date is shown at the bottom of this page.'],
      },
      { h: 'Contact', p: [contactEn] },
    ],
  },
};
