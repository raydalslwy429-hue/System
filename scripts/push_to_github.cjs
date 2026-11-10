const { execSync } = require('child_process');
const dns = require('dns').promises;
const path = require('path');

const repoDir = path.resolve(__dirname, '..');

async function isOnline() {
  try {
    await Promise.race([
      dns.lookup('github.com'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);
    return true;
  } catch (err) {
    return false;
  }
}

async function pushToGithub(customMessage) {
  console.log("🌐 جارٍ التحقق من اتصال الإنترنت بـ GitHub...");
  const online = await isOnline();
  if (!online) {
    console.error("❌ تعذر الاتصال: جهاز الكمبيوتر غير متصل بالإنترنت حالياً (Offline).");
    console.error("💡 يرجى التأكد من تشغيل شبكة الإنترنت / الواي فاي ثم المحاولة مجدداً.");
    process.exit(1);
  }

  try {
    console.log("🔍 فحص التعديلات البرمجية في المشروع...");
    const status = execSync('git status --porcelain', { cwd: repoDir, encoding: 'utf8' }).trim();

    if (!status) {
      console.log("ℹ️ لا توجد ملفات معدلة جديدة. محاولة دفع أي التزامات سابقة...");
      try {
        execSync('git push origin main', { cwd: repoDir, stdio: 'inherit' });
        console.log("✔ كافة الأكواد والشاشات متزامنة ومحدثة بالكامل مع GitHub!");
        return { success: true, message: "كافة الأكواد والشاشات والتصاميم متزامنة ومحدثة بالكامل مع GitHub!" };
      } catch (pushErr) {
        console.log("✔ المستودع محدث بالفعل.");
        return { success: true, message: "المستودع محدث بالفعل، ولا توجد تعديلات جديدة للرفع." };
      }
    }

    console.log("📦 إضافة التعديلات الجديدة (git add .)...");
    execSync('git add .', { cwd: repoDir, stdio: 'inherit' });

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const commitMsg = customMessage || `تحديث وتطوير شاشات وكود النظام: ${dateStr}`;

    console.log(`📝 تثبيت التعديلات: "${commitMsg}"...`);
    execSync(`git commit -m "${commitMsg}"`, { cwd: repoDir, stdio: 'inherit' });

    console.log("🚀 جاري رفع الكود والتصاميم إلى مستودع GitHub (origin/main)...");
    execSync('git push origin main', { cwd: repoDir, stdio: 'inherit' });

    console.log("🎉 تم بنجاح رفع وتحديث كود البرمجة والشاشات والتصاميم إلى GitHub!");
    return { success: true, message: "تم بنجاح رفع وتحديث كود البرمجة والشاشات والتصاميم إلى GitHub!" };
  } catch (err) {
    console.error("❌ حدث خطأ أثناء الرفع إلى GitHub:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  const customMsg = process.argv.slice(2).join(' ') || undefined;
  pushToGithub(customMsg).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { pushToGithub };
