from pyteal import *


class Book:
    class Variables:
        name = Bytes("NAME")
        image = Bytes("IMAGE")
        description = Bytes("DESCRIPTION")
        price = Bytes("PRICE")
        sold = Bytes("SOLD")
        likes = Bytes("LIKES")  # Uint64
        liked = Bytes("liked")

    class AppMethods:
        like = Bytes("like")
        dislike = Bytes("dislike")
        buy = Bytes("buy")

    def application_creation(self):
        return Seq([
            # checks for any empty/invalid values in the input data
            Assert(Txn.application_args.length() == Int(4)),
            Assert(Txn.note() == Bytes("books:uv1")),
            Assert(
                And(
                    Len(Txn.application_args[0])  > Int(0),
                    Len(Txn.application_args[1])  > Int(0),
                    Len(Txn.application_args[2])  > Int(0),
                    Btoi(Txn.application_args[3]) > Int(0),
                )
            ),
            App.globalPut(self.Variables.name, Txn.application_args[0]),
            App.globalPut(self.Variables.image, Txn.application_args[1]),
            App.globalPut(self.Variables.description, Txn.application_args[2]),
            App.globalPut(self.Variables.price, Btoi(Txn.application_args[3])),
            App.globalPut(self.Variables.sold, Int(0)),
            App.globalPut(self.Variables.likes, Int(0)),
            Approve()
        ])

    def setOptIn(self):
        return Seq([
            App.localPut(Txn.sender(), self.Variables.liked, Int(0)),
            Approve()  
        ])

    # allow users to buy a book
    # checks are carried to ensure that the sender is a valid buyer and 
    # the amount sent in the payment transactions matches the book price
    def buy(self):
        count = Txn.application_args[1]
        valid_number_of_transactions = Global.group_size() == Int(2)

        valid_payment_to_seller = And(
            Gtxn[1].type_enum() == TxnType.Payment,
            Gtxn[0].sender() != Global.creator_address(),
            Gtxn[1].receiver() == Global.creator_address(),
            Gtxn[1].amount() == App.globalGet(self.Variables.price) * Btoi(count),
            Gtxn[1].sender() == Gtxn[0].sender(),
        )

        can_buy = And(valid_number_of_transactions,
                      valid_payment_to_seller)

        update_state = Seq([
            App.globalPut(self.Variables.sold, App.globalGet(self.Variables.sold) + Btoi(count)),
            Approve()
        ])

        return If(can_buy).Then(update_state).Else(Reject())

    # likes a book
    def like(self):

        return Seq([
            Assert(App.localGet(Txn.sender(), self.Variables.liked) == Int(0)),
            App.localPut(Txn.sender(), self.Variables.liked, Int(1)),
            App.globalPut(self.Variables.likes, App.globalGet(self.Variables.likes) + Int(1)),
            Approve()
        ])


    # dislikes a book
    def dislike(self):
        return Seq([
            Assert(App.localGet(Txn.sender(), self.Variables.liked) == Int(1)),
            App.localPut(Txn.sender(), self.Variables.liked, Int(0)),
            App.globalPut(self.Variables.likes, App.globalGet(self.Variables.likes) - Int(1)),
            Approve()
        ])
        
    def application_deletion(self):
        return Return(Txn.sender() == Global.creator_address())

    def application_start(self):
        return Cond(
            [Txn.application_id() == Int(0), self.application_creation()],
            [Txn.on_completion() == OnComplete.DeleteApplication, self.application_deletion()],
            [Txn.on_completion() == OnComplete.OptIn, self.setOptIn()],
            [Txn.application_args[0] == self.AppMethods.buy, self.buy()],
            [Txn.application_args[0] == self.AppMethods.like, self.like()],
            [Txn.application_args[0] == self.AppMethods.dislike, self.dislike()]
        )

    def approval_program(self):
        return self.application_start()

    def clear_program(self):
        return Return(Int(1))
