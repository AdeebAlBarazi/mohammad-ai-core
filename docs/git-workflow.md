# GitHub Workflow — رفع المشروع وتحديثه (Windows PowerShell)

هذا الدليل يوضّح كيفية رفع مشروع `systems/marketplace` إلى GitHub للمرة الأولى، وكيفية تحديث التغييرات لاحقًا، مع أفضل الممارسات للأفرع وطلبات الدمج وحماية الأسرار.

## المتطلبات
- Git مثبت وحساب GitHub جاهز.
- تنفيذ الأوامر من داخل المجلد: `systems/marketplace`.

## الرفع الأول (One‑Time Init)
```powershell
git init
git add .
git commit -m "feat(ai): add portable assistant core + API + docs"
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```
- بديل باستخدام GitHub CLI:
```powershell
gh repo create <USER>/<REPO> --source . --private --push --remote origin
```

## تحديث التغييرات لاحقًا (سريع على main)
عندما تكون الوحيد على المستودع:
```powershell
git status
git add -A
git commit -m "chore: update AI profile and docs"
git pull --rebase
git push
```
ملاحظات:
- `git pull --rebase` يقلّل كوميّتات الدمج غير الضرورية.
- استخدم رسائل Commit واضحة ودقيقة.

## تدفق احترافي بالأفرع + Pull Request
موصى به للعمل التعاوني أو الميزات الكبيرة:
```powershell
git checkout -b feat/ai-streaming
git add -A
git commit -m "feat(ai): add SSE streaming response"
git push -u origin feat/ai-streaming
```
- بعد المراجعة على GitHub:
```powershell
git checkout main
git pull --rebase
git merge --ff-only origin/feat/ai-streaming
git push
```

## التحقق السريع
```powershell
git status
git remote -v
git branch -vv
git log --oneline -n 10
git diff
```

## حل مشاكل شائعة
- تتبع ملف سري بالخطأ:
```powershell
# أضف النمط إلى .gitignore ثم:
git rm --cached path/to/secret.file
git commit -m "fix: untrack secret file"
git push
```
- تعارض دمج (Merge Conflict):
  1) افتح الملفات المتعارضة وحلّها يدويًا.
  2) ثم:
```powershell
git add -A
git rebase --continue  # إن كنت بمنتصف rebase
# أو commit عادي إذا لزم
```

## حماية الأسرار
- لا تدفع `.env` أو مفاتيح API؛ تم استثناءها في `.gitignore`.
- استخدم متغيرات البيئة محليًا، وGitHub Actions Secrets عند الأتمتة.

## إصدار ووسم (Release)
وسم نسخة قابلة للنشر:
```powershell
git tag -a v0.1.0 -m "Initial AI assistant MVP"
git push origin v0.1.0
```
يمكن إعداد GitHub Actions لإعداد إصدار تلقائي عند دفع الوسم (انظر CI لاحقًا).

## نصائح إضافية
- حافظ على هيكل رسائل الكوميّت: `type(scope): summary` مثل `feat(ai): ...`, `chore(docs): ...`.
- أنشئ فروعًا قصيرة العمر لكل ميزة أو إصلاح.
- راجع `README-AI.md` لتعريف المتغيرات البيئية وتشغيل المساعد الذكي.
