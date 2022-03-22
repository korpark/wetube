import User from "../models/User";
import fetch from "node-fetch";
import bcrypt from "bcrypt";



export const getJoin = (req, res) => res.render("join", { pageTitle: "Join" });
export const postJoin = async (req, res) => {
  const { name, username, email, password, password2, location } = req.body;
  const pageTitle = "Join";
  if (password !== password2) {
    return res.status(400).render("join", {
      pageTitle,
      errorMessage: "Password confirmation does not match.",
    });
  }
  const exists = await User.exists({ $or: [{ username }, { email }] });
  if (exists) {
    return res.status(400).render("join", {
      pageTitle,
      errorMessage: "This username/email is already taken.",
    });
  }
  try {
    await User.create({
      name,
      username,
      email,
      password,
      location,
    });
    return res.redirect("/login");
  } catch (error) {
    return res.status(400).render("join", {
      pageTitle: "Upload Video",
      errorMessage: error._message,
    });
  }
};
export const getLogin = (req, res) =>
  res.render("login", { pageTitle: "Login" });

export const postLogin = async (req, res) => {
  const { username, password } = req.body;
  const pageTitle = "Login";
  const user = await User.findOne({ username, socialOnly: false });
  if (!user) {
    return res.status(400).render("login", {
      pageTitle,
      errorMessage: "An account with this username does not exists.",
    });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(400).render("login", {
      pageTitle,
      errorMessage: "Wrong password",
    });
  }
  req.session.loggedIn = true;
  req.session.user = user;
  return res.redirect("/");
};

export const logout = (req, res) => {
  req.session.destroy();
  return res.redirect("/");
};
export const getEdit = (req, res) => {
  return res.render("edit-profile", { pageTitle: "Edit Profile" });
};
export const postEdit = async (req, res) => {
  const {
    session: {
      user: { _id, avatarUrl },
    },
    body: { name, email, username, location },
    file,
  } = req;

  const isHeroku = process.env.NODE_ENV === "production"

  const updatedUser = await User.findByIdAndUpdate(
    _id,
    {
      avatarUrl: file ? (isHeroku ? file.location : file.path) : avatarUrl,
      name,
      email,
      username,
      location,
    },
    { new: true }
    );
    req.session.user = updatedUser;
    return res.redirect("/");
  };
  
  export const getChangePassword = (req, res) => {
    if (req.session.user.socialOnly === true) {
      req.flash("error", "Can't change password.");
      return res.redirect("/");
    }
    return res.render("change-password", { pageTitle: "Change Password" });
  };
  export const postChangePassword = async (req, res) => {
    const {
      session: {
        user: { _id },
      },
      body: { oldPassword, NewPassword, NewPasswordConfirmation },
    } = req;
    const user = await User.findById(_id);
    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) {
      return res.status(400).render("change-password", {
        pageTitle: "Change Password",
        errorMessage: "The current password is incorrect",
      });
    }
    if (NewPassword !== NewPasswordConfirmation) {
      return res.status(400).render("change-password", {
        pageTitle: "Change Password",
        errorMessage: "The password does not match the confirmation",
      });
    }
    user.password = NewPassword;
    await user.save();
    req.flash("info", "Password updated");
    return res.redirect("logout");
  };
  
  export const seeUserProfile = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id).populate({
      path: "videos",
      populate: {
        path: "owner",
        model: "User",
      },
    });
    if (!user) {
    return res.status(404).render("404", { pageTitle: "User not found." });
  }
  return res.render("profile", {
    pageTitle: user.name,
    user,
  });
};


export const startGithubLogin = (req, res) => {
  const baseUrl = "https://github.com/login/oauth/authorize";
  const config = {
    client_id: process.env.GH_CLIENT,
    scope: "read:user user:email",
  };
  const params = new URLSearchParams(config).toString();
  const finalUrl = `${baseUrl}?${params}`;
  return res.redirect(finalUrl);
};

export const FinishGithubLogin = async (req, res) => {
  const baseUrl = "https://github.com/login/oauth/access_token"
  const config = {
    client_id: process.env.GH_CLIENT,
    client_secret: process.env.GH_SECRET,
    code: req.query.code
  }
  const params = new URLSearchParams(config).toString()
  const finalUrl = `${baseUrl}?${params}`
  const tokenRequest = await (
    await fetch(finalUrl, {
      method: "POST",
      headers: {
        Accept: "application/json"
      }
    })
  ).json()
  if ("access_token" in tokenRequest) {
    const {access_token} = tokenRequest
    const apiURL = "http://api.github.com"
    const userData = await (
      await fetch(`${apiURL}/user`, {
        headers: {
          Authorization: `token ${access_token}`
        }
      })
    ).json()
    const emailData = await (
      await fetch(`${apiURL}/user/emails`, {
        headers: {
          Authorization: `token ${access_token}`
        },
      })).json()
      const emailObj = emailData.find(
        (email) => email.primary === true && email.verified === true
      )
      if (!emailObj) {
        return res.redirect("/login")
      }
      const existingUser = await User.findOne({email: emailObj.email})
      if (existingUser) {
        req.session.loggedIn = true;
        req.session.user = existingUser;
        return res.redirect("/")
      } else {
        const user = await User.create({
          name: userData.name,
          email: emailObj.email,
          username: userData.login,
          location: userData.location,
          password: "",
          socialOnly: true
        })
        req.session.loggedIn = true;
        req.session.user = user;
        return res.redirect("/")
      }
    } else {
      return res.redirect("/")
    }
}


export const startKakaoLogin = (req, res) => {
  const baseUrl = "https://kauth.kakao.com/oauth/authorize"
  const config = {
    client_id: process.env.KAKAO_REST_API_KEY,
    redirect_url: process.env.KAKAO_REDIRECT_KEY,
    code: req.query.code
    }
  const params = new URLSearchParams(config).toString()
  const finalUrl = `${baseUrl}?${params}`
  console.log(finalUrl)
  return res.redirect(finalUrl)
}